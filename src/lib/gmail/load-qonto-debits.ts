import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isGmailConfigured } from "@/lib/gmail/config";
import { fetchQontoUpcomingDebitsFromGmail } from "@/lib/gmail/fetch-qonto-debits";
import type { QontoUpcomingDebit } from "@/lib/gmail/qonto-debit-parser";
import { withAuthorizedGmailClient } from "@/lib/gmail/tokens";

type SupabaseDb = SupabaseClient<Database>;

/** Charge les prochains prélèvements Qonto depuis Gmail (best-effort, ne bloque pas le dashboard). */
export async function loadUpcomingQontoDebits(
  supabase: SupabaseDb,
  userId: string
): Promise<QontoUpcomingDebit[]> {
  if (!isGmailConfigured()) return [];
  try {
    const debits = await withAuthorizedGmailClient(supabase, userId, fetchQontoUpcomingDebitsFromGmail);
    return debits ?? [];
  } catch (error) {
    console.warn("[gmail/qonto-debits] unavailable:", error);
    return [];
  }
}
