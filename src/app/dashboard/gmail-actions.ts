"use server";

import { gmailAccount, type GmailAccount } from "@/lib/gmail/accounts";
import { withSyncJob } from "@/lib/security/sync-job";

import { syncHiwayInvoices } from "@/lib/gmail/sync-invoices";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gmailRedirectUriForOrigin, isGmailConfigured, resolveRequestOrigin } from "@/lib/gmail/config";
import { buildGmailConsentUrl } from "@/lib/gmail/oauth";
import {
  deleteGmailToken,
  loadGmailTokenRow,
  withAuthorizedGmailClient
} from "@/lib/gmail/tokens";
import { fetchQontoUpcomingDebitsFromGmail } from "@/lib/gmail/fetch-qonto-debits";
import type { QontoUpcomingDebit } from "@/lib/gmail/qonto-debit-parser";
import {
  type HiwayInvoice
} from "@/lib/gmail/hiway-invoice-parser";
import {
  loadStoredHiwayInvoices
} from "@/lib/gmail/hiway-invoice-store";
import {
  GMAIL_OAUTH_STATE_COOKIE,
  GMAIL_OAUTH_STATE_MAX_AGE_SECONDS
} from "@/lib/gmail/oauth-state";

export type GmailConnectionStatus = {
  /** Variables d'env OAuth Google présentes côté serveur. */
  configured: boolean;
  /** Un compte Gmail est lié à l'utilisateur. */
  connected: boolean;
  /** Adresse email connectée (si connue). */
  email: string | null;
  accounts?: { id: GmailAccount; email: string | null; connected: boolean }[];
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

  const row = await loadGmailTokenRow(supabase, user.id, "primary");
  const secondary = await loadGmailTokenRow(supabase, user.id, "secondary");
  console.info("[gmail] account status", { primary: Boolean(row?.refresh_token), secondary: Boolean(secondary?.refresh_token) });
  return { configured, connected: Boolean(row?.refresh_token), email: row?.email ?? null,
    accounts: [{ id: "primary", email: row?.email ?? null, connected: Boolean(row?.refresh_token) }, { id: "secondary", email: secondary?.email ?? null, connected: Boolean(secondary?.refresh_token) }] };
}

export async function getGmailConnectUrl(returnSection?: "pilote" | "courses", account: GmailAccount = "primary"): Promise<{ url: string }> {
  if (!isGmailConfigured()) {
    throw new Error(
      "Gmail non configuré : définissez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI. Voir .env.example."
    );
  }
  await requireUser();
  const selectedAccount = gmailAccount(account);
  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GMAIL_OAUTH_STATE_MAX_AGE_SECONDS
  });
  cookieStore.set("gmail_oauth_account", selectedAccount, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: GMAIL_OAUTH_STATE_MAX_AGE_SECONDS });
  cookieStore.set("gmail_oauth_return", returnSection === "pilote" || returnSection === "courses" ? returnSection : "activite", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: GMAIL_OAUTH_STATE_MAX_AGE_SECONDS
  });
  // Production uses the explicitly configured OAuth origin, never forwarded headers.
  const origin = resolveRequestOrigin(await headers());
  const redirectUri = gmailRedirectUriForOrigin(origin) ?? undefined;
  return { url: buildGmailConsentUrl(state, redirectUri) };
}

export async function loadHiwayInvoices(): Promise<{ invoices: HiwayInvoice[] }> {
  const { supabase, user } = await requireUser();
  const invoices = await loadStoredHiwayInvoices(supabase, user.id);
  return { invoices };
}

export async function fetchHiwayInvoices(account: GmailAccount = "primary"): Promise<{ invoices: HiwayInvoice[] }> {
  const { supabase, user } = await requireUser();
  await withSyncJob(supabase, user.id, "gmail", () => syncHiwayInvoices(supabase, user.id, gmailAccount(account)));
  revalidatePath("/dashboard");

  const stored = await loadStoredHiwayInvoices(supabase, user.id);
  return { invoices: stored };
}

export async function fetchUpcomingQontoDebits(): Promise<{ debits: QontoUpcomingDebit[]; connected: boolean }> {
  const { supabase, user } = await requireUser();
  const debits = await withAuthorizedGmailClient(supabase, user.id, fetchQontoUpcomingDebitsFromGmail, "primary");
  console.info("[qonto] gmail connection", { connected: debits !== null });
  return { debits: debits ?? [], connected: debits !== null };
}

export async function disconnectGmail(account: GmailAccount = "primary"): Promise<{ ok: true }> {
  const { supabase, user } = await requireUser();
  await deleteGmailToken(supabase, user.id, gmailAccount(account));
  revalidatePath("/dashboard");
  return { ok: true };
}
