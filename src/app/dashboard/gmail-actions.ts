"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isGmailConfigured } from "@/lib/gmail/config";
import { buildGmailConsentUrl } from "@/lib/gmail/oauth";
import {
  clearGmailTokenIfInvalidGrant,
  deleteGmailToken,
  getAuthorizedGmailClient,
  loadGmailTokenRow,
  withAuthorizedGmailClient
} from "@/lib/gmail/tokens";
import { GMAIL_RECONNECT_REQUIRED_MESSAGE, isInvalidGrantError } from "@/lib/gmail/oauth-grant";
import { fetchHiwayInvoicesFromGmail } from "@/lib/gmail/fetch-invoices";
import { fetchQontoUpcomingDebitsFromGmail } from "@/lib/gmail/fetch-qonto-debits";
import type { QontoUpcomingDebit } from "@/lib/gmail/qonto-debit-parser";
import {
  applyHiwayInvoiceBillingRules,
  type HiwayInvoice
} from "@/lib/gmail/hiway-invoice-parser";
import {
  deleteStoredHiwayInvoices,
  loadStoredHiwayInvoices,
  upsertHiwayInvoices
} from "@/lib/gmail/hiway-invoice-store";
import { BILLABLE_CLIENT_TJM_HT } from "@/lib/billable-client-days";
import { loadBillableActivitySettings } from "@/lib/supabase/dashboard-loaders";

export type GmailConnectionStatus = {
  /** Variables d'env OAuth Google présentes côté serveur. */
  configured: boolean;
  /** Un compte Gmail est lié à l'utilisateur. */
  connected: boolean;
  /** Adresse email connectée (si connue). */
  email: string | null;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase non configuré (mode démo).");
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  return { supabase, user };
}

export async function getGmailConnectionStatus(): Promise<GmailConnectionStatus> {
  const configured = isGmailConfigured();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { configured, connected: false, email: null };
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { configured, connected: false, email: null };

  try {
    const row = await loadGmailTokenRow(supabase, user.id);
    return { configured, connected: Boolean(row?.refresh_token), email: row?.email ?? null };
  } catch {
    return { configured, connected: false, email: null };
  }
}

export async function getGmailConnectUrl(): Promise<{ url: string }> {
  if (!isGmailConfigured()) {
    throw new Error(
      "Gmail non configuré : définissez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI. Voir .env.example."
    );
  }
  await requireUser();
  return { url: buildGmailConsentUrl(randomUUID()) };
}

export async function loadHiwayInvoices(): Promise<{ invoices: HiwayInvoice[] }> {
  const { supabase, user } = await requireUser();
  const invoices = await loadStoredHiwayInvoices(supabase, user.id);
  return { invoices };
}

export async function fetchHiwayInvoices(): Promise<{ invoices: HiwayInvoice[] }> {
  const { supabase, user } = await requireUser();
  const client = await getAuthorizedGmailClient(supabase, user.id);
  if (!client) {
    throw new Error(GMAIL_RECONNECT_REQUIRED_MESSAGE);
  }

  const { billableRatePeriods, initialBillableTjmHt } = await loadBillableActivitySettings(
    supabase,
    user.id
  );
  const fallbackTjmHt = initialBillableTjmHt ?? BILLABLE_CLIENT_TJM_HT;

  let fetched: HiwayInvoice[];
  try {
    fetched = await fetchHiwayInvoicesFromGmail(client);
  } catch (error) {
    if (await clearGmailTokenIfInvalidGrant(supabase, user.id, error)) {
      throw new Error(GMAIL_RECONNECT_REQUIRED_MESSAGE);
    }
    throw error;
  }
  const invoices = fetched.map((inv) =>
    applyHiwayInvoiceBillingRules(inv, { billableRatePeriods, fallbackTjmHt })
  );

  await upsertHiwayInvoices(supabase, user.id, invoices);
  revalidatePath("/dashboard");

  const stored = await loadStoredHiwayInvoices(supabase, user.id);
  return { invoices: stored };
}

export async function fetchUpcomingQontoDebits(): Promise<{ debits: QontoUpcomingDebit[] }> {
  const { supabase, user } = await requireUser();
  const debits = await withAuthorizedGmailClient(supabase, user.id, fetchQontoUpcomingDebitsFromGmail);
  return { debits: debits ?? [] };
}

export async function disconnectGmail(): Promise<{ ok: true }> {
  const { supabase, user } = await requireUser();
  await Promise.all([deleteGmailToken(supabase, user.id), deleteStoredHiwayInvoices(supabase, user.id)]);
  revalidatePath("/dashboard");
  return { ok: true };
}
