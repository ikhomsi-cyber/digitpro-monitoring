import Link from "next/link";
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
import { DashboardDemoToggle } from "@/components/DashboardDemoToggle";
import { getMockTransactions } from "@/lib/mock-data";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { DashboardClient } from "./DashboardClient";
import { DashboardHeaderProfile } from "@/components/dashboard/DashboardHeaderProfile";
import { ParisWeatherBadge } from "@/components/dashboard/ParisWeatherBadge";
import { Logo } from "@/components/ui/Logo";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";

/** Always evaluate Supabase env + session at request time. */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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
    company: (t.company ?? "").trim()
  }));

  type SupabaseTxRow = {
    id: string;
    date: string;
    label: string | null;
    category: string | null;
    amount: number | string;
    balance?: number | string | null;
    company: string | null;
    scope?: "pro" | "personal" | null;
  };

  let rawRows: SupabaseTxRow[] = [];
  if (envMode === "SUPABASE" && dataMode === "SUPABASE" && supabase) {
    const withBalance = await supabase!
      .from("transactions")
      .select("id,date,label,category,amount,balance,company,scope")
      .order("date", { ascending: false })
      .limit(5000);

    const errMsg =
      withBalance.error && typeof withBalance.error.message === "string"
        ? withBalance.error.message
        : "";
    const missingColumn = (col: string) =>
      errMsg &&
      new RegExp(col, "i").test(errMsg) &&
      /(could not find|schema cache|does not exist)/i.test(errMsg);
    const balanceColumnMissing = missingColumn("balance");
    const scopeColumnMissing = missingColumn("scope");

    if (balanceColumnMissing || scopeColumnMissing) {
      const withoutBalance = await supabase!
        .from("transactions")
        .select(
          scopeColumnMissing
            ? "id,date,label,category,amount,company"
            : "id,date,label,category,amount,company,scope"
        )
        .order("date", { ascending: false })
        .limit(5000);
      if (!withoutBalance.error) {
        rawRows = (withoutBalance.data ?? []) as unknown as SupabaseTxRow[];
      }
    } else if (!withBalance.error) {
      rawRows = (withBalance.data ?? []) as unknown as SupabaseTxRow[];
    }
  }

  const transactions: DashboardTx[] =
    dataMode === "DEMO"
      ? demoTransactions
      : rawRows.map((row) => ({
          id: String(row.id),
          date: String(row.date).slice(0, 10),
          label: String(row.label ?? ""),
          category: mapExpenseCategoryLabel(String(row.category ?? "")),
          amount: Number(row.amount),
          balance: row.balance == null ? null : Number(row.balance),
          company: String(row.company ?? "").trim(),
          scope: row.scope === "personal" ? "personal" : "pro"
        }));

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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <nav className="sticky top-[env(safe-area-inset-top)] z-40 flex flex-col gap-4 border-b border-ink-200 bg-white/95 backdrop-blur pb-4 dark:border-ink-800 dark:bg-ink-950/95 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap min-w-0 items-center gap-3">
          <Logo />
          <DashboardHeaderProfile variant="nav" />
          <div className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dataMode === "DEMO" ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            {envMode === "DEMO"
              ? "Mode démo — variables Supabase absentes."
              : demoPreferenceOn
                ? "Mode démo activé — données fictives."
                : `Connecté · ${user?.email}`}
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-2 sm:justify-end">
          <ParisWeatherBadge />
          {showDarkModeToggle ? <DarkModeToggle /> : null}
          <PrivacyToggle />
          {envMode === "SUPABASE" ? <DashboardDemoToggle enabled={demoPreferenceOn} /> : null}
          {envMode === "DEMO" ? null : (
            <form action="/logout" method="post" className="contents">
              <button
                type="submit"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-ink-300 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:border-ink-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-ink-500 sm:flex-initial"
              >
                Déconnexion
                <LogOut className="h-4 w-4 text-ink-500 dark:text-ink-400" />
              </button>
            </form>
          )}
        </div>
      </nav>

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

      <DashboardClient
        runtimeMode={dataMode}
        canWrite={dataMode === "SUPABASE"}
        syncKey={syncKey}
        initialTransactions={transactions}
        initialBillableWorkDays={initialBillableWorkDays}
        initialBillableTjmHt={initialBillableTjmHt}
      />

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
