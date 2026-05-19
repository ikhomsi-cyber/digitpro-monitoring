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

  const { error } = await supabase
    .from("transactions")
    .update({ category: mapExpenseCategoryLabel(category) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/categorisation");
  revalidatePath("/dashboard");
}

export async function markPowensTransactionAsNdfDigitPro(formData: FormData) {
  formData.set("category", "NDF DigitPro");
  return updatePowensTransactionCategory(formData);
}
