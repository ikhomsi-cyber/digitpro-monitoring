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
import {
  loadInitialUserTransactionsFromSupabase,
  needsDashboardFullHistorySync
} from "@/lib/supabase/fetch-all-transactions";
import { getMockTransactions } from "@/lib/mock-data";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import nextDynamic from "next/dynamic";
import { analyzeLmnp } from "@/lib/lmnp-analyze";
import { DashboardClient } from "./DashboardClient";
import { DashboardSectionProvider } from "@/components/dashboard/DashboardSectionContext";

const LMNPClient = nextDynamic(
  () => import("@/app/lmnp/LMNPClient").then((mod) => ({ default: mod.LMNPClient })),
  { loading: () => null }
);
import { Logo } from "@/components/ui/Logo";
import { DashboardDesktopSidebar, DashboardFloatingDock } from "@/components/dashboard/DashboardFloatingDock";
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { BillableActivityProvider } from "@/components/dashboard/BillableActivityContext";
import { BILLABLE_CLIENT_TJM_HT, type BillableRatePeriod } from "@/lib/billable-client-days";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { loadQontoLiveBalanceEur } from "@/lib/qonto/live-balance";
import {
  loadBillableActivitySettings,
  loadTransactionYearBounds
} from "@/lib/supabase/dashboard-loaders";
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

import { parseDashboardPanelParam } from "@/lib/dashboard-panel";

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
      <div className="premium-dashboard-page flex min-h-dvh items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Logo className="mx-auto mb-8" />
          <div className="h-eyebrow">Session expirée</div>
          <h1 className="mt-2 h-display">Veuillez vous reconnecter.</h1>
          <div className="mt-8">
            <Link href="/login" className="premium-cta inline-flex">
              Aller à la connexion <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
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
  let transactionYearBounds: {
    minYear: number;
    maxYear: number;
    minDateIso: string;
    maxDateIso: string;
  } | null = null;
  let initialBillableWorkDays: string[] = [];
  let initialBillableVacationDays: string[] = [];
  let initialBillableTjmHt: number | null = null;
  let initialAnnualRevenueTargetHt: number | null = null;
  let billableRatePeriods: BillableRatePeriod[] = [];
  let qontoLiveBalanceEur: number | null = null;
  let syncFullHistoryOnMount = false;

  if (envMode === "SUPABASE" && dataMode === "SUPABASE" && supabase) {
    const transactionsPromise = (async () => {
      console.time("dashboard:transactions");
      try {
        return await loadInitialUserTransactionsFromSupabase(supabase);
      } finally {
        console.timeEnd("dashboard:transactions");
      }
    })();

    const [transactionsRes, boundsRes, billableRes, liveBalance] = await Promise.all([
      transactionsPromise,
      loadTransactionYearBounds(supabase),
      user
        ? loadBillableActivitySettings(supabase, user.id)
        : Promise.resolve({
            initialBillableWorkDays: [],
            initialBillableVacationDays: [],
            initialBillableTjmHt: null,
            initialAnnualRevenueTargetHt: null,
            billableRatePeriods: []
          }),
      loadQontoLiveBalanceEur()
    ]);
    qontoLiveBalanceEur = liveBalance;
    rawRowsMapped = transactionsRes.transactions;
    transactionsLoadError = transactionsRes.errorMessage ?? null;
    transactionYearBounds = boundsRes;
    initialBillableWorkDays = billableRes.initialBillableWorkDays;
    initialBillableVacationDays = billableRes.initialBillableVacationDays;
    initialBillableTjmHt = billableRes.initialBillableTjmHt;
    initialAnnualRevenueTargetHt = billableRes.initialAnnualRevenueTargetHt;
    billableRatePeriods = billableRes.billableRatePeriods;
    syncFullHistoryOnMount = needsDashboardFullHistorySync(
      rawRowsMapped,
      transactionYearBounds?.minDateIso
    );
    if (transactionsRes.errorMessage) {
      console.warn("[dashboard] transactions:", transactionsRes.errorMessage);
    }
  }

  const transactions: DashboardTx[] = dataMode === "DEMO" ? demoTransactions : rawRowsMapped;

  const syncKey = `${transactions.length}:${transactions[0]?.id ?? ""}:${transactions.at(-1)?.id ?? ""}`;
  const showDarkModeToggle = isDarkModeUiEnabled();
  const demoMode = dataMode === "DEMO" || demoPreferenceOn;
  const powensCloudEnabled = isPowensCloudConfigured();
  const powensPersonalSyncEnabled = powensCloudEnabled && powensPersonalSyncUiEnabled();
  const powensPrimaryAxis = powensPrimaryImportAxis();
  const heroStats = computeDashboardHeroStats(transactions, new Date(), {
    qontoLiveBalanceEur: dataMode === "SUPABASE" ? qontoLiveBalanceEur : null
  });
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
      billableRatePeriods={billableRatePeriods}
      persistToSupabase={persistBillableToSupabase}
      initialWorkDayIsos={initialBillableWorkDays}
      initialVacationDayIsos={initialBillableVacationDays}
      initialAnnualRevenueTargetHt={initialAnnualRevenueTargetHt}
    >
    <DashboardDesktopSidebar />
    <div data-page="dashboard" className="premium-dashboard-page mx-auto max-w-6xl px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:pb-10 lg:ml-32 lg:mr-8 lg:max-w-none lg:px-8 2xl:mx-auto 2xl:mr-auto 2xl:max-w-[1720px]">
      <DashboardTopNav
        envMode={envMode}
        dataMode={dataMode}
        demoPreferenceOn={demoPreferenceOn}
        dummyDataActive={dummyDataActive}
        showDummyDataToggle={envMode === "SUPABASE"}
        userEmail={user?.email}
        showDarkModeToggle={showDarkModeToggle}
        showLogout={envMode !== "DEMO"}
        canWrite={dataMode === "SUPABASE"}
        powensCloudEnabled={powensCloudEnabled}
        powensPersonalSyncEnabled={powensPersonalSyncEnabled}
        powensPrimaryImportAxis={powensPrimaryAxis}
      />

      {showLmnpPanel ? (
        <LMNPClient
          analysis={analyzeLmnp(transactions)}
          demoMode={demoMode}
          loadError={transactionsLoadError}
        />
      ) : (
        <Suspense fallback={null}>
          <DashboardSectionProvider>
            <DashboardClient
              syncKey={syncKey}
              initialTransactions={transactions}
              transactionYearBounds={transactionYearBounds}
              initialDashboardScope={initialDashboardScope}
              heroStats={heroStats}
              heroContextMessage={heroContextMessage}
              showContextBanner={showContextBanner}
              demoMode={demoMode}
              loadError={transactionsLoadError}
              syncFullHistoryOnMount={syncFullHistoryOnMount}
            />
            <DashboardFloatingDock />
          </DashboardSectionProvider>
        </Suspense>
      )}

      <footer className="mt-16 flex flex-col gap-2 border-t border-ink-200/80 pt-8 text-xs text-ink-500 dark:border-white/[0.08] dark:text-white/40 sm:flex-row sm:items-center sm:justify-between">
        {(envMode === "DEMO" || demoPreferenceOn || dummyDataActive) ? (
        <div className="flex items-center gap-2">
          <Logo size={20} withWordmark={false} />
          <span>
            {envMode === "DEMO"
              ? "Mode démo (mock) · ne remplace pas un conseil comptable."
              : demoPreferenceOn
                ? "Mode démo volontaire · données fictives."
                : "Affichage masqué : montants fictifs."}
          </span>
        </div>
        ) : <span aria-hidden />}
        <span className="font-medium text-ink-500 dark:text-white/45">
          © {new Date().getFullYear()} DigitPro. Conçu par Iliass KHOMSI.
        </span>
      </footer>
    </div>
    </BillableActivityProvider>
    </DashboardDummyDataProvider>
  );
}
