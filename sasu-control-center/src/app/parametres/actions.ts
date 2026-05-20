"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readRequiredString(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`Champ manquant : ${key}.`);
  return value;
}

export async function createBillableRatePeriod(formData: FormData) {
  const clientName = readRequiredString(formData, "clientName");
  const startDate = readRequiredString(formData, "startDate");
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const tjmHt = Number(formData.get("tjmHt"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Date de début invalide.");
  if (endDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) throw new Error("Date de fin invalide.");
  if (!Number.isFinite(tjmHt) || tjmHt <= 0) throw new Error("TJM HT invalide.");

  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("billable_rate_periods").insert({
    user_id: user.id,
    client_name: clientName,
    start_date: startDate,
    end_date: endDateRaw || null,
    tjm_ht: Math.round(tjmHt * 100) / 100
  });
  if (error) throw new Error(error.message);

  revalidatePath("/parametres");
  revalidatePath("/dashboard");
}

export async function deleteBillableRatePeriod(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured (demo mode).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("billable_rate_periods")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/parametres");
  revalidatePath("/dashboard");
}
