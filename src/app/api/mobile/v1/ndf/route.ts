import { z } from "zod";
import { revalidatePath } from "next/cache";
import { mobileAuth, mobileFailure, mobileJSON, MobileError } from "@/lib/mobile/auth";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { listPendingNdfCandidatesForMonth, summarizeNdfDigitProForMonth, NDF_DIGITPRO_CATEGORY } from "@/lib/ndf-digitpro";
import { resolveNdfRejectionCategory } from "@/lib/categorisation-candidates";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";

export const dynamic = "force-dynamic";
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const decisionSchema = z.object({ transactionId: z.string().uuid(), action: z.enum(["validate", "reject"]) });

async function load(request: Request) {
  const auth = await mobileAuth(request);
  const [loaded, count] = await Promise.all([
    loadAllUserTransactionsFromSupabase(auth.client),
    auth.client.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", auth.userId)
  ]);
  if (loaded.errorMessage || count.error || count.count !== loaded.transactions.length) {
    throw new MobileError(503, "Notes de frais incomplètes. Réessayez.");
  }
  return { ...auth, transactions: loaded.transactions };
}

export async function GET(request: Request) {
  try {
    const { transactions } = await load(request);
    const parsed = monthSchema.safeParse(new URL(request.url).searchParams.get("month"));
    if (!parsed.success) throw new MobileError(400, "Mois invalide.");
    return mobileJSON({ month: parsed.data,
      pending: listPendingNdfCandidatesForMonth(transactions, parsed.data, "personal"),
      validated: summarizeNdfDigitProForMonth(transactions.filter(tx => tx.scope === "personal"), parsed.data)
    });
  } catch (error) { return mobileFailure(error); }
}

export async function PUT(request: Request) {
  try {
    const { client, userId, transactions } = await load(request);
    const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new MobileError(400, "Décision invalide.");
    const tx = transactions.find(row => row.id === parsed.data.transactionId && row.scope === "personal");
    if (!tx) throw new MobileError(404, "Transaction introuvable.");
    if (!listPendingNdfCandidatesForMonth(transactions, tx.date.slice(0, 7), "personal").some(row => row.id === tx.id)) {
      throw new MobileError(409, "Cette transaction n’est plus à valider. Actualisez la liste.");
    }
    const categories = buildBankinReferenceCategoryList(transactions.filter(row => row.importFormat === "bankin").map(row => row.category));
    const category = parsed.data.action === "validate" ? NDF_DIGITPRO_CATEGORY : resolveNdfRejectionCategory(tx, categories);
    const result = await client.from("transactions").update({ category, category_manual: true })
      .eq("id", tx.id).eq("user_id", userId).eq("scope", "personal")
      .eq("category_manual", tx.categoryManual === true)
      .select("id");
    if (result.error) throw new MobileError(503, "Enregistrement impossible.");
    if (result.data?.length !== 1) throw new MobileError(409, "Transaction modifiée. Actualisez la liste.");
    revalidatePath("/dashboard");
    revalidatePath("/categorisation");
    return mobileJSON({ ok: true, category });
  } catch (error) { return mobileFailure(error); }
}
