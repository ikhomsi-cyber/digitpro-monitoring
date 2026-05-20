import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { Logo } from "@/components/ui/Logo";
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { AppSectionNav } from "@/components/AppSectionNav";
import { DashboardDummyDataProvider } from "@/components/dashboard/DashboardDisplayFormatContext";
import { isDashboardDummyDataActive } from "@/lib/dashboard-dummy-data-preference";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";
import { ParametresClient, type BillableRatePeriod } from "./ParametresClient";

export const dynamic = "force-dynamic";

type RateRow = {
  id: string;
  client_name: string;
  start_date: string;
  end_date: string | null;
  tjm_ht: number | string;
};

export default async function ParametresPage() {
  const envMode = getSupabaseRuntimeMode();
  const cookieStore = await cookies();
  const supabase = envMode === "SUPABASE" ? await createSupabaseServerClient() : null;
  const user = !supabase ? null : (await supabase.auth.getUser()).data.user;
  const dummyDataActive = isDashboardDummyDataActive(cookieStore);
  const showDarkModeToggle = isDarkModeUiEnabled();

  if (envMode === "SUPABASE" && !user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <Logo className="mx-auto mb-8" />
        <h1 className="h-display">Connexion requise</h1>
        <p className="mt-4 text-ink-600 dark:text-ink-300">Connectez-vous pour modifier les paramètres.</p>
        <div className="mt-8">
          <Link href={`/login?next=${encodeURIComponent("/parametres")}`} className="btn-primary">
            Connexion
          </Link>
        </div>
      </div>
    );
  }

  let periods: BillableRatePeriod[] = [];
  let loadError: string | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("billable_rate_periods")
      .select("id,client_name,start_date,end_date,tjm_ht")
      .order("start_date", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      periods = ((data ?? []) as RateRow[]).map((row) => ({
        id: String(row.id),
        clientName: String(row.client_name ?? ""),
        startDate: String(row.start_date).slice(0, 10),
        endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
        tjmHt: Number(row.tjm_ht)
      }));
    }
  }

  return (
    <DashboardDummyDataProvider active={dummyDataActive}>
      <div className="premium-dashboard-page mx-auto max-w-6xl px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:pb-10 lg:px-8">
        <DashboardTopNav
          envMode={envMode}
          dataMode={envMode}
          demoPreferenceOn={false}
          dummyDataActive={dummyDataActive}
          showDummyDataToggle={envMode === "SUPABASE"}
          userEmail={user?.email}
          showDarkModeToggle={showDarkModeToggle}
          showLogout={envMode !== "DEMO"}
        />

        <AppSectionNav />

        <header className="mt-5 rounded-[2rem] border border-ink-200 bg-white p-5 shadow-[0_16px_60px_-28px_rgba(0,0,0,0.28)] dark:border-white/[0.08] dark:bg-gradient-to-b dark:from-[#101412] dark:via-[#080a09] dark:to-[#050505] sm:p-7">
          <Link
            href="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-ink-900 dark:text-white/45 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Retour dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
                Paramètres
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-white">
                TJM par client et par période
              </h1>
            </div>
          </div>
        </header>

        <main className="mt-5">
          {loadError ? (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-800 dark:text-rose-200">
              {loadError}
            </div>
          ) : (
            <ParametresClient periods={periods} />
          )}
        </main>
      </div>
    </DashboardDummyDataProvider>
  );
}
