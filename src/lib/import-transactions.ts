import "server-only";
import { revalidatePath } from "next/cache";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeMetricsFromTransactions, trailingTwelveMonthStartDateIso, type DashboardTx } from "@/lib/dashboard-metrics";
import { transactionImportHash } from "@/lib/transaction-hash";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { isNearDuplicateCardPayment, isPowensComingStoredLabel, POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW } from "@/lib/ndf-digitpro";
type SupabaseServer = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
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

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const postgresError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const description =
    `${postgresError.message ?? ""} ${postgresError.details ?? ""} ${postgresError.hint ?? ""}`.toLowerCase();
  const normalizedColumn = column.toLowerCase();

  return (
    ((postgresError.code === "PGRST204" || postgresError.code === "42703") &&
      description.includes(normalizedColumn)) ||
    (description.includes("could not find") && description.includes(normalizedColumn)) ||
    (description.includes("schema cache") && description.includes(normalizedColumn))
  );
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

  for (let i = 0; i < hashes.length; i += chunkSize) {
    const slice = hashes.slice(i, i + chunkSize);
    const { data, error } = await client
      .from("transactions")
      .select("id,content_hash,category_manual")
      .in("content_hash", slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.content_hash || !row.id) continue;
      map.set(row.content_hash, {
        id: row.id,
        categoryManual: row.category_manual === true
      });
    }
  }
  return map;
}

function shiftIsoDate(iso: string, dayDelta: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type StoredTxRow = {
  id: string;
  date: string;
  label: string;
  amount: number;
  categoryManual: boolean;
  content_hash: string | null;
};

async function fetchStoredTransactionsBetween(
  client: SupabaseServer,
  minDate: string,
  maxDate: string
): Promise<StoredTxRow[]> {
  const { data, error } = await client
    .from("transactions")
    .select("id,date,label,amount,content_hash,category_manual")
    .gte("date", minDate)
    .lte("date", maxDate);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    label: String(row.label ?? ""),
    amount: Number(row.amount),
    categoryManual: row.category_manual === true,
    content_hash: row.content_hash ?? null
  }));
}

async function resolvePowensFuzzyImportRows(
  client: SupabaseServer,
  toInsert: Array<ImportTx & { content_hash: string }>
): Promise<{
  toInsert: Array<ImportTx & { content_hash: string }>;
  fuzzyMerge: Array<
    ImportTx & { content_hash: string; id: string; categoryManual: boolean; refreshLabelDate: boolean }
  >;
}> {
  if (!toInsert.length) return { toInsert, fuzzyMerge: [] };

  const dates = toInsert.map((row) => row.date).sort();
  const minDate = shiftIsoDate(dates[0]!, -POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW);
  const maxDate = shiftIsoDate(dates[dates.length - 1]!, POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW);
  const stored = await fetchStoredTransactionsBetween(client, minDate, maxDate);

  const fuzzyMerge: Array<
    ImportTx & { content_hash: string; id: string; categoryManual: boolean; refreshLabelDate: boolean }
  > = [];
  const keptInsert: Array<ImportTx & { content_hash: string }> = [];
  const matchedIds = new Set<string>();

  for (const row of toInsert) {
    const match = stored.find(
      (candidate) =>
        !matchedIds.has(candidate.id) &&
        isNearDuplicateCardPayment(
          candidate.label,
          candidate.amount,
          candidate.date,
          row.label,
          row.amount,
          row.date,
          POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW
        )
    );
    if (match) {
      matchedIds.add(match.id);
      fuzzyMerge.push({
        ...row,
        id: match.id,
        categoryManual: match.categoryManual,
        refreshLabelDate:
          isPowensComingStoredLabel(match.label) && !isPowensComingStoredLabel(row.label)
      });
      continue;
    }
    keptInsert.push(row);
  }

  const dedupedInsert: Array<ImportTx & { content_hash: string }> = [];
  for (const row of keptInsert) {
    const dup = dedupedInsert.some((existing) =>
      isNearDuplicateCardPayment(
        existing.label,
        existing.amount,
        existing.date,
        row.label,
        row.amount,
        row.date,
        POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW
      )
    );
    if (!dup) dedupedInsert.push(row);
  }

  return { toInsert: dedupedInsert, fuzzyMerge };
}

/** Supprime les lignes [En cours] en base lorsqu'un jumeau comptabilisé existe. */
async function dedupeStoredPowensComingTransactions(client: SupabaseServer): Promise<number> {
  const start = trailingTwelveMonthStartDateIso();
  const stored = await fetchStoredTransactionsBetween(client, start, "2099-12-31");
  const comingRows = stored.filter((row) => isPowensComingStoredLabel(row.label));
  if (!comingRows.length) return 0;

  const settledRows = stored.filter((row) => !isPowensComingStoredLabel(row.label));
  const toDelete = comingRows
    .filter((coming) =>
      settledRows.some(
        (settled) =>
          settled.id !== coming.id &&
          isNearDuplicateCardPayment(
            coming.label,
            coming.amount,
            coming.date,
            settled.label,
            settled.amount,
            settled.date,
            POWENS_COMING_SETTLED_DEDUPE_DAY_WINDOW
          )
      )
    )
    .map((row) => row.id);

  if (!toDelete.length) return 0;
  const { error } = await client.from("transactions").delete().in("id", toDelete);
  if (error) throw new Error(error.message);
  return toDelete.length;
}

export async function syncMonthlyMetricsFromDb(client: SupabaseServer) {
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

export async function importTransactionsWithClient(
  client: SupabaseServer,
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

  const sessionInsertBase = {
    source_filename: meta.sourceFilename,
    format: meta.format,
    row_count: originalCount,
    inserted_count: 0,
    skipped_duplicate_count: 0
  };
  const sessionInsertPayload =
    fileHashSupported && meta.fileHash
      ? { ...sessionInsertBase, file_hash: meta.fileHash }
      : sessionInsertBase;
  let sessionInsert = await client
    .from("import_sessions")
    .insert(sessionInsertPayload)
    .select("id")
    .single();

  if (sessionInsert.error && isMissingColumnError(sessionInsert.error, "file_hash")) {
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

  let toInsert: PreparedRow[] = [];
  let toMerge: Array<{ id: string; categoryManual: boolean; refreshLabelDate?: boolean } & PreparedRow> =
    [];

  for (const p of prepared) {
    const existing = existingRows.get(p.content_hash);
    if (existing) {
      toMerge.push({
        ...p,
        id: existing.id,
        categoryManual: existing.categoryManual,
        refreshLabelDate: false
      });
    } else {
      toInsert.push(p);
    }
  }

  if (meta.format === "powens" && toInsert.length > 0) {
    const fuzzy = await resolvePowensFuzzyImportRows(client, toInsert);
    toInsert = fuzzy.toInsert;
    toMerge.push(...fuzzy.fuzzyMerge);
  }

  type InsertedPayload = {
    date: string;
    label: string;
    category: string;
    amount: number;
    balance: number | null;
    company: string;
    bank_name: string | null;
    scope: "pro" | "personal";
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
  const insertedRowsAgg: Array<{
    id: string;
    date: string;
    label: string;
    category: string;
    amount: number;
    company: string;
    bankName?: string | null;
    scope: "pro" | "personal";
  }> = [];

  const batchSize = 200;
  for (let i = 0; i < insertedPayload.length; i += batchSize) {
    const slice = insertedPayload.slice(i, i + batchSize);
    if (!slice.length) continue;
    const attempt = await client
      .from("transactions")
      .insert(slice)
      .select("id,date,label,category,amount,company,bank_name,scope");
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
        bankName: String(r.bank_name ?? "").trim() || null,
        scope: r.scope === "personal" ? "personal" : "pro"
      });
    }
  }

  const mergeBatch = 25;
  for (let i = 0; i < toMerge.length; i += mergeBatch) {
    const slice = toMerge.slice(i, i + mergeBatch);
    const results = await Promise.all(
      slice.map(async (row) => {
        const baseUpdate = {
          ...(row.categoryManual ? {} : { category: row.category }),
          ...(row.refreshLabelDate
            ? { label: row.label, date: row.date, content_hash: row.content_hash }
            : {}),
          bank_name: row.bankName ?? null,
          import_session_id: importSessionId,
          balance: row.balance ?? null
        };
        return client.from("transactions").update(baseUpdate).eq("id", row.id);
      })
    );
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw new Error(firstError.message);
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
  if (meta.format === "powens") {
    try {
      await dedupeStoredPowensComingTransactions(client);
    } catch (error) {
      console.error("[import] dedupe Powens [En cours]:", error);
    }
  }
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

