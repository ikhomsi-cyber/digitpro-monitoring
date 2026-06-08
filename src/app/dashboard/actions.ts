"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DASHBOARD_DEMO_COOKIE,
  getDashboardEffectiveDataMode
} from "@/lib/dashboard-demo-preference";
import { DASHBOARD_DUMMY_DATA_COOKIE } from "@/lib/dashboard-dummy-data-preference";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import {
  computeMetricsFromTransactions,
  trailingTwelveMonthStartDateIso,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { transactionImportHash } from "@/lib/transaction-hash";
import { fetchQontoTransactionsForImport } from "@/lib/qonto/sync";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import {
  BANKIN_UNCATEGORIZED_CATEGORY,
} from "@/lib/bankin/categorize";
import {
  buildBankinReferenceCategoryList,
  normalizeBankinReferenceCategory
} from "@/lib/bankin/reference-categories";
import { parseBankinTransactionsWorkbook } from "@/lib/bankin/parse-xlsx";
import {
  isPowensCloudConfigured,
  powensCloudCreateUser,
  powensCloudFetchTransactions,
  type PowensImportRow
} from "@/lib/powens/cloud-api";
import {
  buildPowensConnectWebviewUrl,
  powensFetchTemporaryConnectCode,
  powensWebviewDomainHostname
} from "@/lib/powens/webview-connect";
import {
  powensAccountFilterForAxis,
  powensDefaultCompanyLabel,
  powensPrimaryImportAxis,
  type PowensImportAxis
} from "@/lib/powens/config";
import { createHash } from "crypto";
type ImportTx = {
  date: string;
  label: string;
  category: string;
  amount: number;
  balance?: number | null;
  company: string;
  bankName?: string | null;
  scope?: "pro" | "personal";
  /** Clé optionnelle pour le content_hash (ex. id transaction import). */
  dedupeKey?: string;
};

function mapPowensRowsToImportTx(rows: PowensImportRow[]): ImportTx[] {
  return rows.map((r) => ({
    date: r.date,
    label: r.label,
    category: r.category,
    amount: r.amount,
    balance: r.balance ?? undefined,
    company: r.company,
    bankName: r.bankName ?? null,
    scope: r.scope,
    dedupeKey: r.dedupeKey
  }));
}

type SupabaseServer = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function loadBankinReferenceCategories(client: SupabaseServer): Promise<Set<string>> {
  const { data, error } = await client
    .from("transactions")
    .select("category,import_sessions!inner(format)")
    .eq("import_sessions.format", "bankin")
    .order("category", { ascending: true });

  if (error) {
    const msg = error.message ?? "";
    if (/import_sessions|relationship|schema cache|PGRST200|PGRST201/i.test(msg)) return new Set();
    throw new Error(msg);
  }

  return new Set(
    buildBankinReferenceCategoryList(
      (data ?? []).map((row) => (row as { category?: string | null }).category)
    )
  );
}

function applyBankinReferenceToPowensRows(rows: ImportTx[], referenceCategories: Set<string>): ImportTx[] {
  if (referenceCategories.size === 0) return rows;
  return rows.map((row) => {
    const category = normalizeBankinReferenceCategory(row.category);
    return {
      ...row,
      category: referenceCategories.has(category) ? category : BANKIN_UNCATEGORIZED_CATEGORY
    };
  });
}

/**
 * True when a Postgrest/PG error means a given column does not exist in the schema cache yet.
 * Lets the action fall back gracefully when the user hasn’t applied recent migrations
 * (e.g. file_hash on import_sessions, balance on transactions).
 */
function isMissingColumnError(err: unknown, column: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  const blob = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  if (e.code === "PGRST204" || e.code === "42703") {
    return blob.includes(column.toLowerCase());
  }
  if (blob.includes("could not find") && blob.includes(column.toLowerCase())) return true;
  if (blob.includes("schema cache") && blob.includes(column.toLowerCase())) return true;
  return false;
}

async function assertSupabaseWritesEnabled() {
  const cookieStore = await cookies();
  const envMode = getSupabaseRuntimeMode();
  const dataMode = getDashboardEffectiveDataMode(envMode, cookieStore);
  if (dataMode === "DEMO") {
    throw new Error(
      "Écritures désactivées : le mode démo est actif (données de démonstration uniquement, pas de connexion à la base)."
    );
  }
}

export async function setDashboardDemoMode(enabled: boolean) {
  const cookieStore = await cookies();
  const envMode = getSupabaseRuntimeMode();
  if (envMode !== "SUPABASE") return;

  if (enabled) {
    cookieStore.set(DASHBOARD_DEMO_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true
    });
  } else {
    cookieStore.delete(DASHBOARD_DEMO_COOKIE);
  }

  revalidatePath("/dashboard");
}

export async function setDashboardDummyDataMode(enabled: boolean) {
  const cookieStore = await cookies();
  const envMode = getSupabaseRuntimeMode();
  if (envMode !== "SUPABASE") return;

  if (enabled) {
    cookieStore.set(DASHBOARD_DUMMY_DATA_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true
    });
  } else {
    cookieStore.delete(DASHBOARD_DUMMY_DATA_COOKIE);
  }

  revalidatePath("/dashboard");
}

function dedupeImportRows(rows: ImportTx[]): {
  unique: Array<ImportTx & { content_hash: string }>;
  skippedInFile: number;
} {
  const unique: Array<ImportTx & { content_hash: string }> = [];
  const seen = new Set<string>();
  let skippedInFile = 0;

  for (const r of rows) {
    const rowCompany = (r.company ?? "").trim();
    const h = transactionImportHash({
      date: r.date,
      label: r.label,
      amount: r.amount,
      dedupeKey: r.dedupeKey
    });
    if (!h) {
      skippedInFile++;
      continue;
    }
    if (seen.has(h)) {
      skippedInFile++;
      continue;
    }
    seen.add(h);
    unique.push({
      ...r,
      company: rowCompany,
      balance: r.balance ?? null,
      content_hash: h
    });
  }

  return { unique, skippedInFile };
}

type ExistingImportRow = {
  id: string;
  categoryManual: boolean;
};

async function fetchExistingRowsByContentHashes(
  client: SupabaseServer,
  hashes: string[]
): Promise<Map<string, ExistingImportRow>> {
  const map = new Map<string, ExistingImportRow>();
  const chunkSize = 120;
  let categoryManualSupported = true;

  for (let i = 0; i < hashes.length; i += chunkSize) {
    const slice = hashes.slice(i, i + chunkSize);
    const query = categoryManualSupported
      ? client.from("transactions").select("id,content_hash,category_manual").in("content_hash", slice)
      : client.from("transactions").select("id,content_hash").in("content_hash", slice);
    const { data, error } = await query;
    if (error) {
      if (categoryManualSupported && isMissingColumnError(error, "category_manual")) {
        categoryManualSupported = false;
        i -= chunkSize;
        continue;
      }
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      if (!row.content_hash || !row.id) continue;
      map.set(row.content_hash, {
        id: row.id,
        categoryManual: categoryManualSupported && "category_manual" in row && row.category_manual === true
      });
    }
  }
  return map;
}

async function syncMonthlyMetricsFromDb(client: SupabaseServer) {
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const start = trailingTwelveMonthStartDateIso();
  const { data: rows, error } = await client
    .from("transactions")
    .select("date,amount,label,category,company")
    .gte("date", start);
  if (error) throw new Error(error.message);

  const txs: DashboardTx[] = (rows ?? []).map((r, i) => ({
    id: `_sync_${i}`,
    date: String(r.date).slice(0, 10),
    label: String(r.label ?? ""),
    category: String(r.category ?? ""),
    amount: Number(r.amount),
    company: String(r.company ?? "").trim()
  }));

  const metrics = computeMetricsFromTransactions(txs, new Date());
  if (!metrics.length) return;

  const payload = metrics.map((m) => ({
    user_id: user.id,
    month: m.month,
    revenue: m.revenue,
    expenses: m.expenses
  }));

  const { error: upErr } = await client
    .from("monthly_metrics")
    .upsert(payload, { onConflict: "user_id,month" });
  if (upErr) throw new Error(upErr.message);
}

async function fetchLatestMetrics(client: SupabaseServer) {
  const { data: metricsRows, error } = await client
    .from("monthly_metrics")
    .select("month,revenue,expenses")
    .order("month", { ascending: true })
    .limit(12);
  if (error) throw new Error(error.message);
  return (metricsRows ?? []).map((m) => ({
    month: m.month,
    revenue: Number(m.revenue),
    expenses: Number(m.expenses)
  }));
}

export async function createTransaction(formData: FormData) {
  await assertSupabaseWritesEnabled();
  const date = String(formData.get("date") || "");
  const label = String(formData.get("label") || "");
  const category = String(formData.get("category") || "");
  const amount = Number(formData.get("amount") || 0);
  const company = String(formData.get("company") || "").trim();
  const scopeRaw = String(formData.get("scope") || "pro");
  const scope: "pro" | "personal" = scopeRaw === "personal" ? "personal" : "pro";

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const insertBase = {
    date,
    label,
    category: mapExpenseCategoryLabel(category),
    amount,
    company
  };
  const withScope = { ...insertBase, scope };
  const { error } = await supabase.from("transactions").insert(withScope);
  if (error && isMissingColumnError(error, "scope")) {
    const { error: retryErr } = await supabase.from("transactions").insert(insertBase);
    if (retryErr) throw new Error(retryErr.message);
  } else if (error) {
    throw new Error(error.message);
  }

  await syncMonthlyMetricsFromDb(supabase);
  revalidatePath("/dashboard");
}

export async function importTransactions(
  transactions: ImportTx[],
  meta: { sourceFilename: string | null; format: "qonto" | "generic" | "bankin" | "powens"; fileHash: string | null }
): Promise<{
  inserted: Array<{
    id: string;
    date: string;
    label: string;
    category: string;
    amount: number;
    company: string;
    bankName?: string | null;
  }>;
  metrics: Array<{ month: string; revenue: number; expenses: number }>;
  skippedInFile: number;
  merged: number;
  importSessionId: string | null;
  fileAlreadyImported?: boolean;
}> {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const client = supabase;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    await syncMonthlyMetricsFromDb(client);
    const metrics = await fetchLatestMetrics(client);
    return { inserted: [], metrics, skippedInFile: 0, merged: 0, importSessionId: null };
  }

  const importRows = transactions.map((t) => ({
    ...t,
    category: mapExpenseCategoryLabel(t.category),
    bankName: t.bankName?.trim() || null
  }));

  const originalCount = importRows.length;

  let fileHashSupported = true;

  if (meta.fileHash) {
    const lookup = await client
      .from("import_sessions")
      .select("id,created_at,source_filename")
      .eq("file_hash", meta.fileHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookup.error && isMissingColumnError(lookup.error, "file_hash")) {
      fileHashSupported = false;
    } else if (lookup.error) {
      throw new Error(lookup.error.message);
    } else if (lookup.data?.id) {
      await syncMonthlyMetricsFromDb(client);
      const metrics = await fetchLatestMetrics(client);
      return {
        inserted: [],
        metrics,
        skippedInFile: 0,
        merged: 0,
        importSessionId: lookup.data.id,
        fileAlreadyImported: true
      };
    }
  }

  type SessionInsertBase = {
    source_filename: string | null;
    format: "qonto" | "generic" | "bankin" | "powens";
    row_count: number;
    inserted_count: number;
    skipped_duplicate_count: number;
  };
  type SessionInsertWithHash = SessionInsertBase & { file_hash: string };
  const sessionInsertBase: SessionInsertBase = {
    source_filename: meta.sourceFilename,
    format: meta.format,
    row_count: originalCount,
    inserted_count: 0,
    skipped_duplicate_count: 0
  };
  const sessionInsertPayload: SessionInsertBase | SessionInsertWithHash =
    fileHashSupported && meta.fileHash
      ? ({ ...sessionInsertBase, file_hash: meta.fileHash } as SessionInsertWithHash)
      : sessionInsertBase;
  let sessionInsert = await client
    .from("import_sessions")
    .insert(sessionInsertPayload)
    .select("id")
    .single();

  if (sessionInsert.error && isMissingColumnError(sessionInsert.error, "file_hash")) {
    fileHashSupported = false;
    sessionInsert = await client
      .from("import_sessions")
      .insert(sessionInsertBase)
      .select("id")
      .single();
  }
  if (sessionInsert.error) throw new Error(sessionInsert.error.message);
  const importSessionId = sessionInsert.data!.id;

  const { unique: prepared, skippedInFile } = dedupeImportRows(importRows);
  const hashes = prepared.map((p) => p.content_hash);
  const existingRows = await fetchExistingRowsByContentHashes(client, hashes);

  type PreparedRow = (typeof prepared)[number];

  const toInsert: PreparedRow[] = [];
  const toMerge: Array<{ id: string; categoryManual: boolean } & PreparedRow> = [];

  for (const p of prepared) {
    const existing = existingRows.get(p.content_hash);
    if (existing) {
      toMerge.push({ ...p, id: existing.id, categoryManual: existing.categoryManual });
    } else {
      toInsert.push(p);
    }
  }

  let balanceSupported = true;
  let bankNameSupported = true;

  type InsertedPayload = {
    date: string;
    label: string;
    category: string;
    amount: number;
    balance?: number | null;
    company: string;
    bank_name?: string | null;
    scope?: "pro" | "personal";
    content_hash: string;
    import_session_id: string;
  };
  const insertedPayload: InsertedPayload[] = toInsert.map((p) => ({
    date: p.date,
    label: p.label,
    category: p.category,
    amount: p.amount,
    balance: p.balance ?? null,
    company: p.company,
    bank_name: p.bankName ?? null,
    scope: p.scope === "personal" ? "personal" : "pro",
    content_hash: p.content_hash,
    import_session_id: importSessionId
  }));
  function stripUnsupportedInsertFields(rows: InsertedPayload[]): InsertedPayload[] {
    return rows.map((row) => {
      const copy: InsertedPayload = { ...row };
      if (!balanceSupported) delete copy.balance;
      if (!bankNameSupported) delete copy.bank_name;
      return copy;
    });
  }

  const insertedRowsAgg: Array<{
    id: string;
    date: string;
    label: string;
    category: string;
    amount: number;
    company: string;
    bankName?: string | null;
    scope?: "pro" | "personal";
  }> = [];

  const batchSize = 200;
  for (let i = 0; i < insertedPayload.length; i += batchSize) {
    const slice = insertedPayload.slice(i, i + batchSize);
    if (!slice.length) continue;
    let attempt = await client
      .from("transactions")
      .insert(stripUnsupportedInsertFields(slice))
      .select("id,date,label,category,amount,company,bank_name,scope");
    if (attempt.error && bankNameSupported && isMissingColumnError(attempt.error, "bank_name")) {
      bankNameSupported = false;
      attempt = await client
        .from("transactions")
        .insert(stripUnsupportedInsertFields(slice))
        .select("id,date,label,category,amount,company,scope");
    }
    if (attempt.error && balanceSupported && isMissingColumnError(attempt.error, "balance")) {
      balanceSupported = false;
      attempt = await client
        .from("transactions")
        .insert(stripUnsupportedInsertFields(slice))
        .select(bankNameSupported ? "id,date,label,category,amount,company,bank_name,scope" : "id,date,label,category,amount,company,scope");
    }
    if (attempt.error && isMissingColumnError(attempt.error, "scope")) {
      // Backwards-compat when the column does not exist yet.
      attempt = await client
        .from("transactions")
        .insert(
          stripUnsupportedInsertFields(slice).map((r) => {
            const copy = { ...r } as InsertedPayload;
            delete copy.scope;
            return copy;
          })
        )
        .select("id,date,label,category,amount,company");
    }
    if (attempt.error) throw new Error(attempt.error.message);
    const batchInserted = attempt.data;
    for (const r of batchInserted ?? []) {
      insertedRowsAgg.push({
        id: r.id,
        date: String(r.date).slice(0, 10),
        label: r.label,
        category: r.category,
        amount: Number(r.amount),
        company: String(r.company ?? ""),
        bankName: "bank_name" in r ? String(r.bank_name ?? "").trim() || null : null,
        scope: r.scope === "personal" ? "personal" : "pro"
      });
    }
  }

  const mergeBatch = 25;
  for (let i = 0; i < toMerge.length; i += mergeBatch) {
    const slice = toMerge.slice(i, i + mergeBatch);
    await Promise.all(
      slice.map(async (row) => {
        const baseUpdate = {
          ...(row.categoryManual ? {} : { category: row.category }),
          ...(bankNameSupported ? { bank_name: row.bankName ?? null } : {}),
          import_session_id: importSessionId
        } as const;
        const fullUpdate = balanceSupported
          ? { ...baseUpdate, balance: row.balance ?? null }
          : baseUpdate;
        let res = await client.from("transactions").update(fullUpdate).eq("id", row.id);
        if (res.error && bankNameSupported && isMissingColumnError(res.error, "bank_name")) {
          bankNameSupported = false;
          const retryBaseUpdate = {
            ...(row.categoryManual ? {} : { category: row.category }),
            import_session_id: importSessionId
          };
          const retryFullUpdate = balanceSupported
            ? { ...retryBaseUpdate, balance: row.balance ?? null }
            : retryBaseUpdate;
          res = await client.from("transactions").update(retryFullUpdate).eq("id", row.id);
        }
        if (res.error && balanceSupported && isMissingColumnError(res.error, "balance")) {
          balanceSupported = false;
          const retryBaseUpdate = {
            ...(row.categoryManual ? {} : { category: row.category }),
            ...(bankNameSupported ? { bank_name: row.bankName ?? null } : {}),
            import_session_id: importSessionId
          };
          res = await client.from("transactions").update(retryBaseUpdate).eq("id", row.id);
        }
        return res;
      })
    );
  }

  const merged = toMerge.length;
  const insertedCount = insertedRowsAgg.length;

  const { error: sessionUpdateErr } = await client
    .from("import_sessions")
    .update({
      inserted_count: insertedCount,
      skipped_duplicate_count: skippedInFile
    })
    .eq("id", importSessionId);

  if (sessionUpdateErr) throw new Error(sessionUpdateErr.message);

  await syncMonthlyMetricsFromDb(client);
  revalidatePath("/dashboard");

  const metrics = await fetchLatestMetrics(client);

  return {
    inserted: insertedRowsAgg,
    metrics,
    skippedInFile,
    merged,
    importSessionId
  };
}

/**
 * Récupère les transactions via l’API Qonto (clé secrète serveur) et les enregistre
 * comme un import CSV (même dédoublonnage `content_hash`).
 */
export async function syncQontoTransactionsFromApi(): Promise<{
  inserted: number;
  merged: number;
  skippedInFile: number;
  totalFromApi: number;
  bankAccountSummary: string;
}> {
  await assertSupabaseWritesEnabled();
  const { rows, bankAccountSummary } = await fetchQontoTransactionsForImport();
  const result = await importTransactions(rows, {
    sourceFilename: `Qonto API · ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    format: "qonto",
    fileHash: null
  });

  return {
    inserted: result.inserted.length,
    merged: result.merged,
    skippedInFile: result.skippedInFile,
    totalFromApi: rows.length,
    bankAccountSummary
  };
}

/**
 * Crée ou réutilise l’utilisateur Powens (Budget Insight : POST /auth/init uniquement si aucune ligne
 * `powens_users` ; sinon réutilise `powens_user_id` + `auth_token`) et met à jour Supabase si création.
 */
export async function preparePowensConnectSession(): Promise<{ userId: string; token: string }> {
  await assertSupabaseWritesEnabled();
  if (!isPowensCloudConfigured()) {
    throw new Error(
      "Powens non configuré : POWENS_DOMAIN (ou POWENS_API_BASE_URL) et POWENS_CLIENT_ID + POWENS_CLIENT_SECRET (Budget Insight), ou POWENS_PLATFORM_BEARER_TOKEN + email (flux legacy). Voir .env.example."
    );
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const usesBiapiInit =
    Boolean(process.env.POWENS_CLIENT_ID?.trim()) && Boolean(process.env.POWENS_CLIENT_SECRET?.trim());
  const email = (user.email ?? "").trim();
  if (!usesBiapiInit && !email) {
    throw new Error("Votre compte Supabase n’a pas d’email : requis pour le flux Powens POST /users (hors Budget Insight /auth/init).");
  }

  const existingRes = await supabase
    .from("powens_users")
    .select("powens_user_id, auth_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingRes.error) {
    const msg = existingRes.error.message ?? "";
    if (/powens_users|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(
        "Table « powens_users » introuvable : appliquez la migration Supabase (20260517100000_powens_users_restore.sql)."
      );
    }
    throw new Error(msg);
  }

  const existingRow = existingRes.data as { powens_user_id?: unknown; auth_token?: unknown } | null;
  const existingUserId = existingRow?.powens_user_id != null ? String(existingRow.powens_user_id).trim() : "";
  const existingToken =
    typeof existingRow?.auth_token === "string" ? existingRow.auth_token.trim() : "";
  if (existingUserId && existingToken) {
    return { userId: existingUserId, token: existingToken };
  }

  const { userId, userToken } = await powensCloudCreateUser(email);

  const upsert = await supabase.from("powens_users").upsert(
    {
      user_id: user.id,
      powens_user_id: userId,
      auth_token: userToken
    },
    { onConflict: "user_id" }
  );

  if (upsert.error) {
    const msg = upsert.error.message ?? "";
    if (/powens_users|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(
        "Table « powens_users » introuvable : appliquez la migration Supabase (20260517100000_powens_users_restore.sql)."
      );
    }
    throw new Error(msg);
  }

  return { userId, token: userToken };
}

/**
 * Repart sur un nouvel utilisateur Powens sans supprimer les transactions déjà importées.
 * Utile quand l'utilisateur stocké répond `noAccount` après une webview incomplète.
 */
export async function resetPowensConnectSession(): Promise<{ userId: string; token: string }> {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("powens_users").delete().eq("user_id", user.id);
  if (error) {
    const msg = error.message ?? "";
    if (!/powens_users|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(msg);
    }
  }

  revalidatePath("/dashboard");
  return preparePowensConnectSession();
}

/**
 * URL de la webview Powens (`https://webview.powens.com/connect?…`) à ouvrir après
 * `preparePowensConnectSession`. Exige POWENS_REDIRECT_URI autorisée dans la console Powens.
 */
export async function getPowensWebviewConnectUrl(): Promise<{ url: string }> {
  await assertSupabaseWritesEnabled();
  if (!isPowensCloudConfigured()) {
    throw new Error(
      "Powens non configuré : POWENS_DOMAIN + CLIENT_ID + CLIENT_SECRET (ou token plateforme). Voir .env.example."
    );
  }
  const clientId = process.env.POWENS_CLIENT_ID?.trim();
  const redirectUri = process.env.POWENS_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    throw new Error(
      "Webview Powens : définissez POWENS_CLIENT_ID et POWENS_REDIRECT_URI (URL exacte autorisée dans la console Powens, ex. http://localhost:3000/api/powens/callback)."
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const rowRes = await supabase
    .from("powens_users")
    .select("auth_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (rowRes.error) {
    const msg = rowRes.error.message ?? "";
    if (/powens_users|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(
        "Table « powens_users » introuvable : appliquez la migration Supabase (20260517100000_powens_users_restore.sql)."
      );
    }
    throw new Error(msg);
  }

  const token = (rowRes.data as { auth_token?: string } | null)?.auth_token?.trim();
  if (!token) {
    throw new Error(
      "Aucun token Powens enregistré : utilisez d’abord « Connecter Powens » (création utilisateur)."
    );
  }

  const temporaryCode = await powensFetchTemporaryConnectCode(token);
  const domainHostname = powensWebviewDomainHostname();
  const webviewLang = process.env.POWENS_WEBVIEW_LANG?.trim().toLowerCase();
  const url = buildPowensConnectWebviewUrl({
    domainHostname,
    clientId,
    redirectUri,
    temporaryCode,
    lang: webviewLang || undefined
  });
  return { url };
}

export async function safeGetPowensWebviewConnectUrl(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  try {
    const { url } = await getPowensWebviewConnectUrl();
    return { ok: true, url };
  } catch (error) {
    console.error("[powens] webview url failed", error);
    return {
      ok: false,
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "Impossible de préparer l’URL Powens Connect."
    };
  }
}

/**
 * Récupère les transactions Powens puis importe (`format: powens`) pour l’axe demandé (SASU ou perso).
 */
async function syncPowensCloudTransactionsForAxis(axis: PowensImportAxis): Promise<{
  inserted: number;
  merged: number;
  skippedInFile: number;
  totalFromApi: number;
  summary: string;
}> {
  await assertSupabaseWritesEnabled();
  if (!isPowensCloudConfigured()) {
    throw new Error(
      "Powens non configuré : POWENS_DOMAIN + CLIENT_ID + CLIENT_SECRET (ou token plateforme). Utilisez d’abord « Connecter Powens »."
    );
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const rowRes = await supabase
    .from("powens_users")
    .select("auth_token, powens_user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (rowRes.error) {
    const msg = rowRes.error.message ?? "";
    if (/powens_users|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(
        "Table « powens_users » introuvable : appliquez la migration Supabase (20260517100000_powens_users_restore.sql)."
      );
    }
    throw new Error(msg);
  }

  const token = (rowRes.data as { auth_token?: string; powens_user_id?: unknown } | null)?.auth_token?.trim();
  if (!token) {
    throw new Error("Aucun token Powens enregistré : utilisez d’abord « Connecter Powens » (création utilisateur + liaison bancaire).");
  }

  const powensUserIdRaw = (rowRes.data as { powens_user_id?: unknown } | null)?.powens_user_id;
  const powensUserId =
    powensUserIdRaw != null && String(powensUserIdRaw).trim() !== ""
      ? String(powensUserIdRaw).trim()
      : null;

  const scope = axis;
  const company = powensDefaultCompanyLabel(axis);
  const filterAccountIds = powensAccountFilterForAxis(axis);

  const rows = await powensCloudFetchTransactions(token, {
    company,
    scope,
    powensUserId,
    filterAccountIds
  });
  const referenceCategories = await loadBankinReferenceCategories(supabase);
  const txs = applyBankinReferenceToPowensRows(mapPowensRowsToImportTx(rows), referenceCategories);

  const axisLabel = axis === "personal" ? "perso" : "SASU";
  const result = await importTransactions(txs, {
    sourceFilename: `Powens API (${axisLabel}) · ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    format: "powens",
    fileHash: null
  });

  return {
    inserted: result.inserted.length,
    merged: result.merged,
    skippedInFile: result.skippedInFile,
    totalFromApi: txs.length,
    summary: `${company} · ${axisLabel}`
  };
}

type PowensSyncSuccess = {
  inserted: number;
  merged: number;
  skippedInFile: number;
  totalFromApi: number;
  summary: string;
};

type PowensSyncActionResult =
  | ({ ok: true } & PowensSyncSuccess)
  | { ok: false; error: string; noAccount: boolean };

function powensSyncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Synchronisation Powens impossible. Consultez les logs serveur pour plus de détails.";
}

function toPowensSyncActionError(error: unknown): PowensSyncActionResult {
  const message = powensSyncErrorMessage(error);
  return {
    ok: false,
    error: message,
    noAccount: message.includes("aucun compte bancaire") || message.includes("noAccount")
  };
}

/**
 * Synchro Powens selon `POWENS_IMPORT_SCOPE` (**personal** par défaut ; `pro` uniquement si la variable vaut `pro`) et les labels / filtres d’axe correspondants.
 */
export async function syncPowensCloudTransactions(): Promise<PowensSyncSuccess> {
  return syncPowensCloudTransactionsForAxis(powensPrimaryImportAxis());
}

export async function safeSyncPowensCloudTransactions(): Promise<PowensSyncActionResult> {
  try {
    const result = await syncPowensCloudTransactionsForAxis(powensPrimaryImportAxis());
    return { ok: true, ...result };
  } catch (error) {
    console.error("[powens] sync failed", error);
    return toPowensSyncActionError(error);
  }
}

/**
 * Import explicite en **perso** (`scope: personal`), même si le bouton principal est en SASU.
 * Activez via `POWENS_SYNC_PERSONAL` ou `POWENS_PERSONAL_COMPANY_LABEL` (+ bouton dashboard).
 */
export async function syncPowensCloudTransactionsPersonal(): Promise<PowensSyncSuccess> {
  return syncPowensCloudTransactionsForAxis("personal");
}

export async function safeSyncPowensCloudTransactionsPersonal(): Promise<PowensSyncActionResult> {
  try {
    const result = await syncPowensCloudTransactionsForAxis("personal");
    return { ok: true, ...result };
  } catch (error) {
    console.error("[powens] personal sync failed", error);
    return toPowensSyncActionError(error);
  }
}

export type PurgePowensDataResult = {
  deletedTransactions: number;
  deletedImportSessions: number;
  deletedPowensUsers: number;
  legacyTablesCleared: string[];
};

/**
 * Supprime toutes les données Powens de l’utilisateur connecté :
 * transactions (sessions `format = powens`), sessions d’import, `powens_users`,
 * et tables legacy LCL / Revolut perso si présentes.
 */
export async function purgePowensData(): Promise<PurgePowensDataResult> {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configuré (mode démo).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: sessions, error: sessionsErr } = await supabase
    .from("import_sessions")
    .select("id")
    .eq("format", "powens");
  if (sessionsErr) throw new Error(sessionsErr.message);

  const sessionIds = (sessions ?? []).map((s) => s.id).filter(Boolean);
  let deletedTransactions = 0;

  if (sessionIds.length > 0) {
    const { count, error: txErr } = await supabase
      .from("transactions")
      .delete({ count: "exact" })
      .in("import_session_id", sessionIds);
    if (txErr) throw new Error(txErr.message);
    deletedTransactions = count ?? 0;
  }

  const { count: deletedSessions, error: delSessionsErr } = await supabase
    .from("import_sessions")
    .delete({ count: "exact" })
    .eq("format", "powens");
  if (delSessionsErr) throw new Error(delSessionsErr.message);

  const { count: deletedPowensUsers, error: delPowensErr } = await supabase
    .from("powens_users")
    .delete({ count: "exact" })
    .eq("user_id", user.id);
  if (delPowensErr) {
    const msg = delPowensErr.message ?? "";
    if (!/powens_users|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(msg);
    }
  }

  const legacyTables = [
    "lcl_transactions",
    "lcl_accounts",
    "revolut_personal_transactions",
    "revolut_personal_accounts"
  ] as const;
  const legacyTablesCleared: string[] = [];

  for (const table of legacyTables) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (!error) {
      legacyTablesCleared.push(table);
      continue;
    }
    const msg = error.message ?? "";
    if (!/does not exist|schema cache|42P01|Could not find the table/i.test(msg)) {
      throw new Error(`${table}: ${msg}`);
    }
  }

  await syncMonthlyMetricsFromDb(supabase);
  revalidatePath("/dashboard");

  return {
    deletedTransactions,
    deletedImportSessions: deletedSessions ?? 0,
    deletedPowensUsers: deletedPowensUsers ?? 0,
    legacyTablesCleared
  };
}

/**
 * Import d’un export Bankin (.xls / .xlsx) dans les transactions **perso** (`scope: personal`).
 * Catégories : hiérarchie Bankin + inférences sur le libellé si « A catégoriser ».
 * Dédoublonnage : même fichier (hash) ignoré si déjà importé ; lignes = empreinte date + libellé + montant.
 */
export async function importBankinPersonalXlsx(formData: FormData) {
  await assertSupabaseWritesEnabled();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Fichier manquant : sélectionnez un export Bankin (.xls ou .xlsx).");
  }
  const nameLower = file.name.toLowerCase();
  if (!nameLower.endsWith(".xls") && !nameLower.endsWith(".xlsx")) {
    throw new Error("Extension non reconnue : attendu .xls ou .xlsx (export Bankin).");
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileHash = createHash("sha256").update(Buffer.from(arrayBuffer)).digest("hex");

  let rows;
  try {
    rows = parseBankinTransactionsWorkbook(arrayBuffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Impossible de lire le fichier Excel.";
    throw new Error(msg);
  }

  if (!rows.length) {
    throw new Error("Aucune transaction valide (date + montant) dans ce fichier.");
  }

  return importTransactions(rows, {
    sourceFilename: file.name,
    format: "bankin",
    fileHash
  });
}

export async function deleteTransaction(id: string) {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await syncMonthlyMetricsFromDb(supabase);
  revalidatePath("/dashboard");
}

export async function updateTransaction(id: string, formData: FormData) {
  await assertSupabaseWritesEnabled();
  const date = String(formData.get("date") || "");
  const label = String(formData.get("label") || "");
  const category = String(formData.get("category") || "");
  const amount = Number(formData.get("amount") || 0);
  const company = String(formData.get("company") || "").trim();

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const mappedCategory = mapExpenseCategoryLabel(category);
  let updateError = (
    await supabase
      .from("transactions")
      .update({ date, label, category: mappedCategory, amount, company, category_manual: true })
      .eq("id", id)
  ).error;

  if (
    updateError &&
    /category_manual/i.test(updateError.message) &&
    /(could not find|schema cache|does not exist)/i.test(updateError.message)
  ) {
    updateError = (
      await supabase
        .from("transactions")
        .update({ date, label, category: mappedCategory, amount, company })
        .eq("id", id)
    ).error;
  }

  if (updateError) throw new Error(updateError.message);

  await syncMonthlyMetricsFromDb(supabase);
  revalidatePath("/dashboard");
}

/**
 * Nettoyage manuel des doublons en base :
 *  - recalcule un content_hash canonique (date + label + amount) pour chaque ligne,
 *  - dans chaque groupe de doublons, garde la plus ancienne et supprime les autres,
 *  - corrige les content_hash null/incohérents sur les survivantes,
 *  - re-synchronise les monthly_metrics.
 *
 * Idempotent : peut être lancé plusieurs fois sans risque, et garantit que les imports
 * ultérieurs détectent les doublons via l’index unique (user_id, content_hash).
 */
export async function deduplicateExistingTransactions(): Promise<{
  scanned: number;
  duplicatesRemoved: number;
  hashesUpdated: number;
}> {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  type Row = {
    id: string;
    date: string;
    label: string;
    amount: number | string;
    content_hash: string | null;
    created_at: string;
  };

  const all: Row[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,date,label,amount,content_hash,created_at")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const buckets = new Map<string, Array<Row & { canonicalHash: string }>>();
  for (const row of all) {
    const canonicalHash = transactionImportHash({
      date: String(row.date).slice(0, 10),
      label: String(row.label ?? ""),
      amount: Number(row.amount)
    });
    if (!canonicalHash) continue;
    const list = buckets.get(canonicalHash) ?? [];
    list.push({ ...row, canonicalHash });
    buckets.set(canonicalHash, list);
  }

  const idsToDelete: string[] = [];
  const idsToFixHash: Array<{ id: string; hash: string }> = [];

  for (const list of buckets.values()) {
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    const survivor = list[0];
    if (!survivor) continue;
    if (survivor.content_hash !== survivor.canonicalHash) {
      idsToFixHash.push({ id: survivor.id, hash: survivor.canonicalHash });
    }
    for (let i = 1; i < list.length; i++) {
      idsToDelete.push(list[i]!.id);
    }
  }

  const fixBatch = 50;
  for (let i = 0; i < idsToFixHash.length; i += fixBatch) {
    const slice = idsToFixHash.slice(i, i + fixBatch);
    await Promise.all(
      slice.map((row) =>
        supabase.from("transactions").update({ content_hash: row.hash }).eq("id", row.id)
      )
    );
  }

  const delBatch = 200;
  for (let i = 0; i < idsToDelete.length; i += delBatch) {
    const slice = idsToDelete.slice(i, i + delBatch);
    if (!slice.length) continue;
    const { error: delErr } = await supabase.from("transactions").delete().in("id", slice);
    if (delErr) throw new Error(delErr.message);
  }

  await syncMonthlyMetricsFromDb(supabase);
  revalidatePath("/dashboard");

  return {
    scanned: all.length,
    duplicatesRemoved: idsToDelete.length,
    hashesUpdated: idsToFixHash.length
  };
}

/**
 * Backfill : pour les transactions historiques qui possèdent un `balance`
 * non-null mais dont le champ `company` ne mentionne pas Qonto (ex. import
 * antérieur où company = "DigitPro SASU"), on suffixe « (Qonto) » afin que
 * la KPI « Solde Qonto » puisse identifier la dernière transaction Qonto.
 *
 * Idempotent : ne touche pas les lignes déjà taggées.
 */
export async function tagExistingTransactionsAsQonto(): Promise<{
  scanned: number;
  updated: number;
}> {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  type Row = { id: string; company: string | null; balance: number | null };

  const all: Row[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,company,balance")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      // Si la colonne balance n'existe pas encore, on ne peut rien faire.
      if (isMissingColumnError(error, "balance")) {
        return { scanned: 0, updated: 0 };
      }
      throw new Error(error.message);
    }
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const updates: Array<{ id: string; company: string }> = [];
  for (const row of all) {
    if (row.balance == null) continue;
    const current = (row.company ?? "").trim();
    if (/qonto/i.test(current)) continue;
    const next = current ? `${current} (Qonto)` : "Qonto";
    updates.push({ id: row.id, company: next });
  }

  const batch = 50;
  for (let i = 0; i < updates.length; i += batch) {
    const slice = updates.slice(i, i + batch);
    await Promise.all(
      slice.map((row) =>
        supabase.from("transactions").update({ company: row.company }).eq("id", row.id)
      )
    );
  }

  revalidatePath("/dashboard");
  return { scanned: all.length, updated: updates.length };
}

const ISO_CAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidIsoCalendarDate(s: string): boolean {
  const m = ISO_CAL_DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Remplace tous les jours travaillés cochés et enregistre le TJM HT (table `user_billable_settings`).
 * Nécessite les migrations `billable_work_days` et `user_billable_settings`.
 */
export async function replaceBillableWorkDays(isoDates: string[], tjmHt: number): Promise<void> {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (!Number.isFinite(tjmHt) || tjmHt <= 0 || tjmHt > 1_000_000) {
    throw new Error("TJM invalide");
  }

  for (const s of isoDates) {
    if (typeof s !== "string" || !isValidIsoCalendarDate(s)) {
      throw new Error(`Date invalide : ${String(s)}`);
    }
  }

  const unique = [...new Set(isoDates)];

  const { error: delErr } = await supabase.from("billable_work_days").delete().eq("user_id", user.id);
  if (delErr) {
    const msg = delErr.message ?? "";
    if (/billable_work_days|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(
        "Table « billable_work_days » introuvable : exécutez la migration Supabase (fichier 20260511120000_billable_work_days.sql)."
      );
    }
    throw new Error(msg);
  }

  if (unique.length > 0) {
    const { error: insErr } = await supabase.from("billable_work_days").insert(
      unique.map((work_date) => ({
        user_id: user.id,
        work_date
      }))
    );
    if (insErr) throw new Error(insErr.message);
  }

  const { error: upsertErr } = await supabase.from("user_billable_settings").upsert(
    {
      user_id: user.id,
      tjm_ht: Math.round(tjmHt * 100) / 100
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) {
    const msg = upsertErr.message ?? "";
    if (/user_billable_settings|does not exist|schema cache|42P01/i.test(msg)) {
      throw new Error(
        "Table « user_billable_settings » introuvable : exécutez la migration Supabase (20260511120000_billable_work_days.sql)."
      );
    }
    throw new Error(msg);
  }

  revalidatePath("/dashboard");
}
