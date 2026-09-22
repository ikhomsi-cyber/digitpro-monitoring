import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PowensImportRow } from "@/lib/powens/cloud-api";
import type { PowensImportAxis } from "@/lib/powens/config";
import { BANKIN_UNCATEGORIZED_CATEGORY } from "@/lib/bankin/categorize";
import { buildBankinPersonalReferenceModel, buildBankinReferenceCategoryList, normalizeBankinReferenceCategory, resolveBankinPersonalCategory, type BankinPersonalReferenceModel, type BankinReferenceTransaction } from "@/lib/bankin/reference-categories";
import type { importTransactionsWithClient } from "@/lib/import-transactions";
type ImportTx = Parameters<typeof importTransactionsWithClient>[1][number];
export function mapPowensRowsToImportTx(rows: PowensImportRow[]): ImportTx[] {
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

type BankinReferenceData = {
  categories: Set<string>;
  personal: BankinPersonalReferenceModel;
};

export async function loadBankinReferenceData(client: SupabaseServer): Promise<BankinReferenceData> {
  const rows: BankinReferenceTransaction[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("transactions")
      .select("id,label,category,import_sessions!inner(format)")
      .eq("import_sessions.format", "bankin")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      const msg = error.message ?? "";
      if (/import_sessions|relationship|schema cache|PGRST200|PGRST201/i.test(msg)) {
        return {
          categories: new Set(),
          personal: buildBankinPersonalReferenceModel([])
        };
      }
      throw new Error(msg);
    }
    rows.push(...((data ?? []) as BankinReferenceTransaction[]));
    if ((data ?? []).length < pageSize) break;
  }

  return {
    categories: new Set(buildBankinReferenceCategoryList(rows.map((row) => row.category))),
    personal: buildBankinPersonalReferenceModel(rows)
  };
}

export function applyBankinReferenceToPowensRows(
  rows: ImportTx[],
  reference: BankinReferenceData,
  scope: PowensImportAxis
): ImportTx[] {
  return rows.map((row) => {
    if (scope === "personal") {
      return {
        ...row,
        category:
          resolveBankinPersonalCategory(reference.personal, row.category, row.label) ??
          BANKIN_UNCATEGORIZED_CATEGORY
      };
    }
    const category = normalizeBankinReferenceCategory(row.category);
    return {
      ...row,
      category: reference.categories.has(category) ? category : BANKIN_UNCATEGORIZED_CATEGORY
    };
  });
}

