import { mobileAuth, mobileJSON, mobileFailure, MobileError } from "@/lib/mobile/auth";
import { z } from "zod";
import { mobileTransactionVat } from "@/lib/mobile/transaction-vat";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { categorizeKnownPersonalTransfer } from "@/lib/bankin/categorize";
export const dynamic = "force-dynamic";
const querySchema = z.object({
  page: z.coerce.number().int().min(0).max(10000).default(0),
  scope: z.enum(["all", "pro", "personal"]).default("all"),
  search: z.string().max(120).default("")
});
export async function GET(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new MobileError(400, "Filtres invalides.");
    const { page, scope, search } = parsed.data;
    let query = client.from("transactions").select("id,date,label,category,amount,balance,company,bank_name,scope,category_manual", { count: "exact" })
      .eq("user_id", userId).order("date", { ascending: false }).order("id", { ascending: false });
    if (scope !== "all") query = query.eq("scope", scope);
    if (search.trim()) query = query.ilike("label", `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error, count } = await query.range(page * 100, page * 100 + 99);
    if (error || count == null) throw new MobileError(503, "Transactions indisponibles.");
    const transactions = (data ?? []).map(row => ({ ...row, vat: mobileTransactionVat({
      id: row.id, date: row.date, label: row.label ?? "", company: row.company ?? "",
      amount: Number(row.amount), scope: row.scope === "personal" ? "personal" : "pro",
      categoryManual: row.category_manual === true,
      category: (row.category_manual ? null : categorizeKnownPersonalTransfer(row.label ?? "", Number(row.amount)))
        ?? mapExpenseCategoryLabel(row.category ?? "")
    }) }));
    return mobileJSON({ transactions, total: count, nextPage: (page + 1) * 100 < count ? page + 1 : null });
  } catch (error) { return mobileFailure(error); }
}
