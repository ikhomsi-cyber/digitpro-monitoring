import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getAuthorizedGmailClient, clearGmailTokenIfInvalidGrant } from "@/lib/gmail/tokens";
import { GMAIL_RECONNECT_REQUIRED_MESSAGE } from "@/lib/gmail/oauth-grant";
import { fetchHiwayInvoicesFromGmail } from "@/lib/gmail/fetch-invoices";
import { applyHiwayInvoiceBillingRules, type HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { upsertHiwayInvoices } from "@/lib/gmail/hiway-invoice-store";
import { loadBillableActivitySettings } from "@/lib/supabase/dashboard-loaders";
import { BILLABLE_CLIENT_TJM_HT } from "@/lib/billable-client-days";

export async function syncHiwayInvoices(supabase: SupabaseClient<Database>, userId: string) {
  const client = await getAuthorizedGmailClient(supabase, userId);
  if (!client) {
    throw new Error(GMAIL_RECONNECT_REQUIRED_MESSAGE);
  }

  const { billableRatePeriods, initialBillableTjmHt } = await loadBillableActivitySettings(
    supabase,
    userId
  );
  const fallbackTjmHt = initialBillableTjmHt ?? BILLABLE_CLIENT_TJM_HT;

  let fetched: HiwayInvoice[];
  try {
    fetched = await fetchHiwayInvoicesFromGmail(client);
  } catch (error) {
    if (await clearGmailTokenIfInvalidGrant(supabase, userId, error)) {
      throw new Error(GMAIL_RECONNECT_REQUIRED_MESSAGE);
    }
    throw error;
  }
  const invoices = fetched.map((inv) =>
    applyHiwayInvoiceBillingRules(inv, { billableRatePeriods, fallbackTjmHt })
  );

  await upsertHiwayInvoices(supabase, userId, invoices);
  return invoices;
}
