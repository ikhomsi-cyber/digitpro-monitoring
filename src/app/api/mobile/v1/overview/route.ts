import { mobileAuth, mobileJSON, mobileFailure, MobileError } from "@/lib/mobile/auth";
import { buildMobileOverview } from "@/lib/mobile/overview";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { loadStoredHiwayInvoices } from "@/lib/gmail/hiway-invoice-store";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const [loaded, count, settings, rates, invoices] = await Promise.all([
      loadAllUserTransactionsFromSupabase(client),
      client.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
      client.from("user_billable_settings").select("tjm_ht").eq("user_id", userId).maybeSingle(),
      client.from("billable_rate_periods").select("client_name,start_date,end_date,tjm_ht", { count: "exact" })
        .eq("user_id", userId).order("start_date", { ascending: false }),
      loadStoredHiwayInvoices(client, userId).catch(() => undefined)
    ]);
    if (loaded.errorMessage || count.error || settings.error || rates.error ||
        count.count !== loaded.transactions.length || rates.count !== rates.data?.length) {
      throw new MobileError(503, "Données incomplètes. Réessayez après synchronisation.");
    }
    const days: string[] = [];
    for (let from = 0; ; from += 1000) {
      const result = await client.from("billable_work_days").select("work_date", { count: "exact" })
        .eq("user_id", userId).order("work_date").range(from, from + 999);
      if (result.error || result.count == null) throw new MobileError(503, "Calendrier indisponible.");
      days.push(...(result.data ?? []).map(r => r.work_date));
      if (days.length >= result.count) break;
      if (!result.data?.length || from >= 49000) throw new MobileError(503, "Calendrier incomplet.");
    }
    return mobileJSON(buildMobileOverview(loaded.transactions, {
      days, tjm: settings.data?.tjm_ht ?? null,
      rates: (rates.data ?? []).map(r => ({ clientName: r.client_name, startDate: r.start_date,
        endDate: r.end_date, tjmHt: Number(r.tjm_ht) })),
      invoices: invoices
    }));
  } catch (error) { return mobileFailure(error); }
}
