import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ArrowUpRight, LogOut } from "lucide-react";
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
import { DashboardHeaderProfile } from "@/components/dashboard/DashboardHeaderProfile";
import { Logo } from "@/components/ui/Logo";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { AppSectionNav } from "@/components/AppSectionNav";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";

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

function parseDashboardPanelParam(
  sp: Record<string, string | string[] | undefined> | undefined
): "lmnp" | null {
  if (!sp) return null;
  const raw = sp.panel;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "lmnp" ? "lmnp" : null;
}

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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <nav className="sticky top-[env(safe-area-inset-top)] z-40 flex flex-row items-center justify-between gap-2 border-b border-ink-200 bg-white/95 py-2 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95 sm:gap-3 sm:py-3">
        {/* Gauche : logo + avatar + badge connexion */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo />
          <DashboardHeaderProfile variant="nav" />
          <div className="hidden min-w-0 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 sm:inline-flex">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                dataMode === "DEMO" ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            <span className="truncate max-w-[16rem]">
              {envMode === "DEMO"
                ? "Mode démo"
                : demoPreferenceOn
                  ? "Mode démo activé"
                  : `Connecté · ${user?.email}`}
            </span>
          </div>
        </div>

        {/* Droite : actions */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {showDarkModeToggle ? <DarkModeToggle /> : null}
          {envMode === "DEMO" ? null : (
            <form action="/logout" method="post" className="contents">
              <button
                type="submit"
                title="Déconnexion"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-ink-300 bg-white px-3 text-sm font-medium text-ink-900 transition hover:border-ink-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-ink-500 sm:min-w-0 sm:px-4"
              >
                <span className="hidden sm:inline">Déconnexion</span>
                <LogOut className="h-4 w-4 text-ink-500 dark:text-ink-400" />
              </button>
            </form>
          )}
        </div>
      </nav>

      {!showLmnpPanel ? (
        <header className="py-6 text-center sm:py-9">
          <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
            <DashboardHeaderProfile />
            <h1 className="text-balance text-center font-display text-3xl font-semibold tracking-apple-tight text-ink-900 dark:text-ink-50 sm:text-left sm:text-4xl">
              DigitPro Consulting Monitoring
            </h1>
          </div>

          <div className="mx-auto mt-3 flex w-full max-w-2xl items-center justify-center gap-3">
            <span className="h-px w-10 bg-ink-200 dark:bg-ink-700" aria-hidden />
            <span
              className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(0,122,255,0.10)]"
              aria-hidden
            />
            <span className="h-px w-10 bg-ink-200 dark:bg-ink-700" aria-hidden />
          </div>

          <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-ink-600 dark:text-ink-300 sm:text-lg">
            {envMode === "DEMO"
              ? "Aucune configuration Supabase détectée : données de démonstration uniquement."
              : demoPreferenceOn
                ? "Prévisualisation hors base. Utilisez le commutateur pour revenir aux données Supabase."
                : "Pilotage finances, trésorerie et chiffre d’affaires — en temps réel."}
          </p>
          <div className="mt-2 text-sm text-ink-500 dark:text-ink-400">by Iliass KHOMSI</div>
        </header>
      ) : null}

      <AppSectionNav offset="dashboard" />

      {showLmnpPanel ? (
        <LMNPClient
          analysis={analyzeLmnp(transactions)}
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
            syncKey={syncKey}
            initialTransactions={transactions}
            transactionYearBounds={transactionYearBounds}
            initialBillableWorkDays={initialBillableWorkDays}
            initialBillableTjmHt={initialBillableTjmHt}
            initialDashboardScope={initialDashboardScope}
          />
        </Suspense>
      )}

      <footer className="mt-16 flex flex-col gap-3 border-t border-ink-200 pt-8 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo size={20} withWordmark={false} />
          <span>
            {envMode === "DEMO"
              ? "Mode démo (mock) · ne remplace pas un conseil comptable."
              : demoPreferenceOn
                ? "Mode démo volontaire · données fictives."
                : "Données Supabase."}
          </span>
        </div>
        <span>Copyright © {new Date().getFullYear()} DigitPro · Iliass KHOMSI.</span>
      </footer>
    </div>
  );
}
