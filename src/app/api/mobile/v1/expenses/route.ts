import { z } from "zod";
import { mobileAuth, mobileJSON, mobileFailure, MobileError } from "@/lib/mobile/auth";
import { mobileExpenseDetail, mobileExpenseDateRange } from "@/lib/mobile/expenses";
import { DERIVED_EXPENSE_BUCKETS } from "@/lib/derived-expense-bucket";
import { loadUserExpensePeriodFromSupabase } from "@/lib/supabase/fetch-all-transactions";
export const dynamic = "force-dynamic";
const schema = z.object({
  category: z.enum(DERIVED_EXPENSE_BUCKETS).refine(value => value !== "BNC" && value !== "TVA"),
  month: z.string().regex(/^(all|\d{4}|\d{4}-(0[1-9]|1[0-2]))$/),
  page: z.coerce.number().int().min(0).max(1250).default(0)
});
export async function GET(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new MobileError(400, "Catégorie ou période invalide.");
    const now = new Date();
    const loaded = await loadUserExpensePeriodFromSupabase(client, userId, mobileExpenseDateRange(parsed.data.month, now));
    if (loaded.errorMessage) {
      throw new MobileError(503, "Données incomplètes. Réessayez après synchronisation.");
    }
    return mobileJSON(mobileExpenseDetail(loaded.transactions, parsed.data.category, parsed.data.month, parsed.data.page, now));
  } catch (error) { return mobileFailure(error); }
}
