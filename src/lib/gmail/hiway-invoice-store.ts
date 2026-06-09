import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";

type SupabaseDb = SupabaseClient<Database>;

const MIGRATION_HINT =
  "Table « hiway_invoices » introuvable : appliquez la migration Supabase (20260609160000_hiway_invoices.sql).";

function isMissingTableError(message: string | undefined): boolean {
  return /hiway_invoices|does not exist|schema cache|42P01/i.test(message ?? "");
}

function rowToInvoice(row: Database["public"]["Tables"]["hiway_invoices"]["Row"]): HiwayInvoice {
  return {
    id: row.gmail_message_id,
    date: row.sent_date,
    subject: row.subject,
    client: row.client,
    amountEur: row.amount_ht_eur != null ? Number(row.amount_ht_eur) : null,
    amountKind: (row.amount_kind as HiwayInvoice["amountKind"]) ?? "HT",
    billedDays: row.billed_days != null ? Number(row.billed_days) : null,
    tjmHtEur: row.tjm_ht_eur != null ? Number(row.tjm_ht_eur) : null
  };
}

export async function loadStoredHiwayInvoices(
  supabase: SupabaseDb,
  userId: string
): Promise<HiwayInvoice[]> {
  const res = await supabase
    .from("hiway_invoices")
    .select("*")
    .eq("user_id", userId)
    .order("sent_date", { ascending: false });

  if (res.error) {
    if (isMissingTableError(res.error.message)) throw new Error(MIGRATION_HINT);
    throw new Error(res.error.message);
  }

  return (res.data ?? []).map(rowToInvoice);
}

export async function upsertHiwayInvoices(
  supabase: SupabaseDb,
  userId: string,
  invoices: readonly HiwayInvoice[]
): Promise<void> {
  if (!invoices.length) return;

  const now = new Date().toISOString();
  const rows = invoices.map((inv) => ({
    user_id: userId,
    gmail_message_id: inv.id,
    sent_date: inv.date || now.slice(0, 10),
    subject: inv.subject,
    client: inv.client,
    amount_ht_eur: inv.amountEur,
    amount_kind: inv.amountKind,
    billed_days: inv.billedDays,
    tjm_ht_eur: inv.tjmHtEur,
    synced_at: now
  }));

  const res = await supabase.from("hiway_invoices").upsert(rows, {
    onConflict: "user_id,gmail_message_id"
  });

  if (res.error) {
    if (isMissingTableError(res.error.message)) throw new Error(MIGRATION_HINT);
    throw new Error(res.error.message);
  }
}

export async function deleteStoredHiwayInvoices(
  supabase: SupabaseDb,
  userId: string
): Promise<void> {
  const res = await supabase.from("hiway_invoices").delete().eq("user_id", userId);
  if (res.error && !isMissingTableError(res.error.message)) {
    throw new Error(res.error.message);
  }
}
