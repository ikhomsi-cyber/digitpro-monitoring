import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ArrowUpRight } from "lucide-react";
import {
  getSupabaseRuntimeMode,
  reportSupabaseEnvDiagnostics
} from "@/lib/supabase/config";
import {
  getDashboardEffectiveDataMode,
  isDashboardDemoPreferenceActive
} from "@/lib/dashboard-demo-preference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";
import { getMockTransactions } from "@/lib/mock-data";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { analyzeLmnp } from "@/lib/lmnp-analyze";
import { DashboardClient } from "./DashboardClient";
import { LMNPClient } from "@/app/lmnp/LMNPClient";
import { ValeurReelleClient } from "@/components/dashboard/ValeurReelleClient";
import { Logo } from "@/components/ui/Logo";
import { AppSectionNav } from "@/components/AppSectionNav";
import { DashboardFloatingDock } from "@/components/dashboard/DashboardFloatingDock";
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { BillableActivityProvider } from "@/components/dashboard/BillableActivityContext";
import { DashboardPremiumHero } from "@/components/dashboard/DashboardPremiumHero";
import { BILLABLE_CLIENT_TJM_HT } from "@/lib/billable-client-days";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";
import { isPowensCloudConfigured } from "@/lib/powens/cloud-api";
import {
  powensPersonalSyncUiEnabled,
  powensPrimaryImportAxis
} from "@/lib/powens/config";
import { DashboardDummyDataProvider } from "@/components/dashboard/DashboardDisplayFormatContext";
import { isDashboardDummyDataActive } from "@/lib/dashboard-dummy-data-preference";

function parseDashboardScopeParam(
  sp: Record<string, string | string[] | undefined> | undefined
): "pro" | "personal" | null {
  if (!sp) return null;
  const raw = sp.scope;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "personal") return "personal";
  if (v === "pro") return "pro";
  return null;
}

import {
  isDashboardAnalyticsPanel,
  parseDashboardPanelParam
} from "@/lib/dashboard-panel";

/** Always evaluate Supabase env + session at request time. */
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialDashboardScope = parseDashboardScopeParam(sp);
  const initialDashboardPanel = parseDashboardPanelParam(sp);
  const showLmnpPanel = initialDashboardPanel === "lmnp";
  const showValeurReellePanel = initialDashboardPanel === "valeur-reelle";
  const showAnalyticsPanel = isDashboardAnalyticsPanel(initialDashboardPanel);
  reportSupabaseEnvDiagnostics("app/dashboard/page");

  const envMode = getSupabaseRuntimeMode();
  const cookieStore = await cookies();
  const dataMode = getDashboardEffectiveDataMode(envMode, cookieStore);
  const demoPreferenceOn =
    envMode === "SUPABASE" && isDashboardDemoPreferenceActive(cookieStore);

  const supabase = envMode === "SUPABASE" ? await createSupabaseServerClient() : null;

  const user = !supabase
    ? null
    : (
        await supabase.auth.getUser()
      ).data.user;

  // If Supabase exists but user isn't logged in, show login prompt.
  if (envMode === "SUPABASE" && !user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <Logo className="mx-auto mb-8" />
        <div className="h-eyebrow">Session expirée</div>
        <h1 className="mt-2 h-display">Veuillez vous reconnecter.</h1>
        <div className="mt-8">
          <Link href="/login" className="btn-primary">
            Aller à la connexion <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const demoTransactions: DashboardTx[] = getMockTransactions().map((t) => ({
    id: t.id,
    date: t.date,
    label: t.label,
    category: mapExpenseCategoryLabel(t.category),
    amount: t.amount,
    company: (t.company ?? "").trim(),
    scope: t.scope === "personal" ? "personal" : "pro"
  }));

  let rawRowsMapped: DashboardTx[] = [];
  let transactionsLoadError: string | null = null;
  if (envMode === "SUPABASE" && dataMode === "SUPABASE" && supabase) {
    const { transactions: loaded, errorMessage } = await loadAllUserTransactionsFromSupabase(supabase);
    rawRowsMapped = loaded;
    transactionsLoadError = errorMessage ?? null;
    if (errorMessage) {
      console.warn("[dashboard] transactions:", errorMessage);
    }
  }

  /** Bornes d’années sur toute la table (indépendant du chargement paginé des lignes détaillées). */
  let transactionYearBounds: { minYear: number; maxYear: number } | null = null;
  if (envMode === "SUPABASE" && dataMode === "SUPABASE" && supabase) {
    const [oldest, newest] = await Promise.all([
      supabase.from("transactions").select("date").order("date", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("transactions").select("date").order("date", { ascending: false }).limit(1).maybeSingle()
    ]);
    const d0 = oldest.data?.date;
    const d1 = newest.data?.date;
    if (!oldest.error && !newest.error && d0 != null && d1 != null) {
      const minYear = Number(String(d0).slice(0, 4));
      const maxYear = Number(String(d1).slice(0, 4));
      if (Number.isFinite(minYear) && Number.isFinite(maxYear) && minYear <= maxYear) {
        transactionYearBounds = { minYear, maxYear };
      }
    }
  }

  const transactions: DashboardTx[] = dataMode === "DEMO" ? demoTransactions : rawRowsMapped;

  let initialBillableWorkDays: string[] = [];
  let initialBillableTjmHt: number | null = null;
  if (envMode === "SUPABASE" && dataMode === "SUPABASE" && supabase && user) {
    const daysRes = await supabase
      .from("billable_work_days")
      .select("work_date")
      .eq("user_id", user.id)
      .order("work_date", { ascending: true });
    if (!daysRes.error && daysRes.data) {
      initialBillableWorkDays = daysRes.data.map((r) =>
        String((r as { work_date: string }).work_date).slice(0, 10)
      );
    }
    const setRes = await supabase
      .from("user_billable_settings")
      .select("tjm_ht")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!setRes.error && setRes.data != null) {
      const raw = (setRes.data as { tjm_ht: number | string }).tjm_ht;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) initialBillableTjmHt = n;
    }
  }

  const syncKey = `${transactions.length}:${transactions[0]?.id ?? ""}:${transactions.at(-1)?.id ?? ""}`;
  const showDarkModeToggle = isDarkModeUiEnabled();
  const demoMode = dataMode === "DEMO" || demoPreferenceOn;
  const powensCloudEnabled = isPowensCloudConfigured();
  const powensPersonalSyncEnabled = powensCloudEnabled && powensPersonalSyncUiEnabled();
  const powensPrimaryAxis = powensPrimaryImportAxis();
  const heroStats = computeDashboardHeroStats(transactions);
  const heroContextMessage =
    envMode === "DEMO"
      ? "Aucune configuration Supabase détectée : données de démonstration uniquement."
      : demoPreferenceOn
        ? "Prévisualisation hors base. Utilisez le commutateur pour revenir aux données Supabase."
        : "";
  const showContextBanner = envMode === "DEMO" || demoPreferenceOn;
  const dummyDataActive = isDashboardDummyDataActive(cookieStore);
  const billableTjmHt = initialBillableTjmHt ?? BILLABLE_CLIENT_TJM_HT;
  const persistBillableToSupabase = dataMode === "SUPABASE" && envMode === "SUPABASE";

  return (
    <DashboardDummyDataProvider active={dummyDataActive}>
    <BillableActivityProvider
      tjmHt={billableTjmHt}
      persistToSupabase={persistBillableToSupabase}
      initialWorkDayIsos={initialBillableWorkDays}
    >
    <div className="premium-dashboard-page mx-auto max-w-6xl px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:pb-10 lg:px-8">
      <DashboardTopNav
        envMode={envMode}
        dataMode={dataMode}
        demoPreferenceOn={demoPreferenceOn}
        dummyDataActive={dummyDataActive}
        showDummyDataToggle={envMode === "SUPABASE"}
        userEmail={user?.email}
        showDarkModeToggle={showDarkModeToggle}
        showLogout={envMode !== "DEMO"}
      />

      {!showAnalyticsPanel || showValeurReellePanel ? (
        <DashboardPremiumHero
          stats={heroStats}
          contextMessage={heroContextMessage}
          showContextBanner={showContextBanner}
        />
      ) : null}

      <AppSectionNav />

      {showLmnpPanel ? (
        <LMNPClient
          analysis={analyzeLmnp(transactions)}
          demoMode={demoMode}
          loadError={transactionsLoadError}
        />
      ) : showValeurReellePanel ? (
        <ValeurReelleClient
          initialTransactions={transactions}
          transactionYearBounds={transactionYearBounds}
          demoMode={demoMode}
          loadError={transactionsLoadError}
        />
      ) : (
        <Suspense
          fallback={
            <div className="mt-6 space-y-6 sm:mt-8">
              <div className="h-40 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800/50" />
              <div className="h-72 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800/50" />
            </div>
          }
        >
          <DashboardClient
            runtimeMode={dataMode}
            canWrite={dataMode === "SUPABASE"}
            powensCloudEnabled={powensCloudEnabled}
            powensPersonalSyncEnabled={powensPersonalSyncEnabled}
            powensPrimaryImportAxis={powensPrimaryAxis}
            syncKey={syncKey}
            initialTransactions={transactions}
            transactionYearBounds={transactionYearBounds}
            initialDashboardScope={initialDashboardScope}
          />
        </Suspense>
      )}

      <footer className="mt-16 flex flex-col gap-3 border-t border-ink-200/80 pt-8 text-xs text-ink-500 dark:border-white/[0.08] dark:text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo size={20} withWordmark={false} />
          <span>
            {envMode === "DEMO"
              ? "Mode démo (mock) · ne remplace pas un conseil comptable."
              : demoPreferenceOn
                ? "Mode démo volontaire · données fictives."
                : dummyDataActive
                  ? "Données Supabase · affichage masqué (montants fictifs)."
                  : "Données Supabase."}
          </span>
        </div>
        <span>Copyright © {new Date().getFullYear()} DigitPro · Iliass KHOMSI.</span>
      </footer>

      <Suspense fallback={null}>
        <DashboardFloatingDock />
      </Suspense>
    </div>
    </BillableActivityProvider>
    </DashboardDummyDataProvider>
  );
}
