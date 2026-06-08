"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";

export async function updatePowensTransactionCategory(formData: FormData) {
  const id = String(formData.get("transactionId") || "");
  const category = String(formData.get("category") || "");
  if (!id || !category) {
    throw new Error("Transaction ou catégorie manquante.");
  }

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
      .update({ category: mappedCategory, category_manual: true })
      .eq("id", id)
      .eq("user_id", user.id)
  ).error;

  if (
    updateError &&
    /category_manual/i.test(updateError.message) &&
    /(could not find|schema cache|does not exist)/i.test(updateError.message)
  ) {
    updateError = (
      await supabase
        .from("transactions")
        .update({ category: mappedCategory })
        .eq("id", id)
        .eq("user_id", user.id)
    ).error;
  }

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/categorisation");
  revalidatePath("/dashboard");
}

export async function markPowensTransactionAsNdfDigitPro(formData: FormData) {
  formData.set("category", "NDF DigitPro");
  return updatePowensTransactionCategory(formData);
}
