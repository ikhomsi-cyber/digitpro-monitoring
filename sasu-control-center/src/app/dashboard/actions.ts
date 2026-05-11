"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DASHBOARD_DEMO_COOKIE,
  getDashboardEffectiveDataMode
} from "@/lib/dashboard-demo-preference";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import {
  computeMetricsFromTransactions,
  trailingTwelveMonthStartDateIso,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { transactionImportHash } from "@/lib/transaction-hash";
import { fetchQontoTransactionsForImport } from "@/lib/qonto/sync";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";

type ImportTx = {
  date: string;
  label: string;
  category: string;
  amount: number;
  balance?: number | null;
  company: string;
  scope?: "pro" | "personal";
};

type SupabaseServer = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

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
      amount: r.amount
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

async function fetchExistingIdsByContentHashes(
  client: SupabaseServer,
  hashes: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const chunkSize = 120;
  for (let i = 0; i < hashes.length; i += chunkSize) {
    const slice = hashes.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("transactions")
      .select("id,content_hash")
      .in("content_hash", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.content_hash && row.id) map.set(row.content_hash, row.id);
    }
  }
  return map;
}

async function syncMonthlyMetricsFromDb(client: SupabaseServer) {
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

  for (const m of metrics) {
    const { error: upErr } = await client
      .from("monthly_metrics")
      .upsert({ month: m.month, revenue: m.revenue, expenses: m.expenses }, { onConflict: "user_id,month" });
    if (upErr) throw new Error(upErr.message);
  }
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
  meta: { sourceFilename: string | null; format: "qonto" | "generic"; fileHash: string | null }
): Promise<{
  inserted: Array<{
    id: string;
    date: string;
    label: string;
    category: string;
    amount: number;
    company: string;
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
    category: mapExpenseCategoryLabel(t.category)
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
    format: "qonto" | "generic";
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
  const existingIds = await fetchExistingIdsByContentHashes(client, hashes);

  type PreparedRow = (typeof prepared)[number];

  const toInsert: PreparedRow[] = [];
  const toMerge: Array<{ id: string } & PreparedRow> = [];

  for (const p of prepared) {
    const existingId = existingIds.get(p.content_hash);
    if (existingId) {
      toMerge.push({ ...p, id: existingId });
    } else {
      toInsert.push(p);
    }
  }

  let balanceSupported = true;

  type InsertedPayload = {
    date: string;
    label: string;
    category: string;
    amount: number;
    balance?: number | null;
    company: string;
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
    scope: p.scope === "personal" ? "personal" : "pro",
    content_hash: p.content_hash,
    import_session_id: importSessionId
  }));
  function stripBalanceFromInsert(rows: InsertedPayload[]): InsertedPayload[] {
    return rows.map((row) => {
      const copy: InsertedPayload = { ...row };
      delete copy.balance;
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
    scope?: "pro" | "personal";
  }> = [];

  const batchSize = 200;
  for (let i = 0; i < insertedPayload.length; i += batchSize) {
    const slice = insertedPayload.slice(i, i + batchSize);
    if (!slice.length) continue;
    let attempt = await client
      .from("transactions")
      .insert(balanceSupported ? slice : stripBalanceFromInsert(slice))
      .select("id,date,label,category,amount,company,scope");
    if (attempt.error && balanceSupported && isMissingColumnError(attempt.error, "balance")) {
      balanceSupported = false;
      attempt = await client
        .from("transactions")
        .insert(stripBalanceFromInsert(slice))
        .select("id,date,label,category,amount,company,scope");
    }
    if (attempt.error && isMissingColumnError(attempt.error, "scope")) {
      // Backwards-compat when the column does not exist yet.
      attempt = await client
        .from("transactions")
        .insert(
          (balanceSupported ? slice : stripBalanceFromInsert(slice)).map((r) => {
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
          category: row.category,
          import_session_id: importSessionId
        } as const;
        const fullUpdate = balanceSupported
          ? { ...baseUpdate, balance: row.balance ?? null }
          : baseUpdate;
        let res = await client.from("transactions").update(fullUpdate).eq("id", row.id);
        if (res.error && balanceSupported && isMissingColumnError(res.error, "balance")) {
          balanceSupported = false;
          res = await client.from("transactions").update(baseUpdate).eq("id", row.id);
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

  const { error } = await supabase
    .from("transactions")
    .update({ date, label, category: mapExpenseCategoryLabel(category), amount, company })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await syncMonthlyMetricsFromDb(supabase);
  revalidatePath("/dashboard");
}

export async function saveSalarySimulation(payload: {
  salaryNet: number;
  companyCostEstimate: number;
  cashAvailableAtTime: number;
  remainingCashEstimate: number;
}) {
  await assertSupabaseWritesEnabled();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("salary_simulations").insert({
    salary_net: payload.salaryNet,
    company_cost_estimate: payload.companyCostEstimate,
    cash_available_at_time: payload.cashAvailableAtTime,
    remaining_cash_estimate: payload.remainingCashEstimate
  });
  if (error) throw new Error(error.message);

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
