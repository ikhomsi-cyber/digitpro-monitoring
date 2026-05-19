import Link from "next/link";
import { CreditCard, Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { Logo } from "@/components/ui/Logo";
import { BANKIN_UNCATEGORIZED_CATEGORY } from "@/lib/bankin/categorize";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";
import { CategorisationClient, type CategorisationTx } from "./CategorisationClient";
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { DashboardPremiumHero } from "@/components/dashboard/DashboardPremiumHero";
import { AppSectionNav } from "@/components/AppSectionNav";
import { DashboardDummyDataProvider } from "@/components/dashboard/DashboardDisplayFormatContext";
import { isDashboardDummyDataActive } from "@/lib/dashboard-dummy-data-preference";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";
import { BillableActivityProvider } from "@/components/dashboard/BillableActivityContext";
import { BILLABLE_CLIENT_TJM_HT } from "@/lib/billable-client-days";
import { computeDashboardHeroStats } from "@/lib/dashboard-hero-stats";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";

export const dynamic = "force-dynamic";

type TxRow = {
  id: string;
  date: string;
  label: string | null;
  amount: number | string;
  company: string | null;
  bank_name: string | null;
  category: string | null;
  import_sessions?: { format: string | null } | null;
};

function normalizeCategory(raw: unknown): string {
  return String(raw ?? "").trim();
}

function isCardPowensLabel(raw: string): boolean {
  const label = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return /\b(cb|carte|card)\b/.test(label);
}

export default async function CategorisationPage() {
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
        <p className="mt-4 text-ink-600 dark:text-ink-300">Connectez-vous pour catégoriser les transactions Powens.</p>
        <div className="mt-8">
          <Link href={`/login?next=${encodeURIComponent("/categorisation")}`} className="btn-primary">
            Connexion
          </Link>
        </div>
      </div>
    );
  }

  let categories: string[] = [];
  let transactions: CategorisationTx[] = [];
  let dashboardTransactions: Awaited<ReturnType<typeof loadAllUserTransactionsFromSupabase>>["transactions"] = [];
  let loadError: string | null = null;
  let initialBillableWorkDays: string[] = [];
  let initialBillableTjmHt: number | null = null;

  if (supabase) {
    const [categoryRes, txRes, loadedTx] = await Promise.all([
      supabase
        .from("transactions")
        .select("category,import_sessions!inner(format)")
        .eq("import_sessions.format", "bankin")
        .order("category", { ascending: true }),
      supabase
        .from("transactions")
        .select("id,date,label,amount,company,bank_name,category,import_sessions!inner(format)")
        .eq("import_sessions.format", "powens")
        .eq("category", BANKIN_UNCATEGORIZED_CATEGORY)
        .order("date", { ascending: false })
        .limit(200),
      loadAllUserTransactionsFromSupabase(supabase)
    ]);
    dashboardTransactions = loadedTx.transactions;

    if (categoryRes.error || txRes.error || loadedTx.errorMessage) {
      loadError = categoryRes.error?.message ?? txRes.error?.message ?? loadedTx.errorMessage ?? "Chargement impossible.";
    } else {
      categories = buildBankinReferenceCategoryList(
        (categoryRes.data ?? []).map((row) => normalizeCategory((row as { category?: unknown }).category))
      );
      transactions = ((txRes.data ?? []) as unknown as TxRow[])
        .map((row) => ({
          id: String(row.id),
          date: String(row.date).slice(0, 10),
          label: String(row.label ?? ""),
          amount: Number(row.amount),
          company: String(row.company ?? "").trim(),
          bankName: row.bank_name ? String(row.bank_name).trim() : null
        }))
        .filter((tx) => isCardPowensLabel(`${tx.label} ${tx.company}`));
    }

    if (user) {
      const [daysRes, setRes] = await Promise.all([
        supabase
          .from("billable_work_days")
          .select("work_date")
          .eq("user_id", user.id)
          .order("work_date", { ascending: true }),
        supabase
          .from("user_billable_settings")
          .select("tjm_ht")
          .eq("user_id", user.id)
          .maybeSingle()
      ]);
      if (!daysRes.error && daysRes.data) {
        initialBillableWorkDays = daysRes.data.map((r) =>
          String((r as { work_date: string }).work_date).slice(0, 10)
        );
      }
      if (!setRes.error && setRes.data != null) {
        const n = Number((setRes.data as { tjm_ht: number | string }).tjm_ht);
        if (Number.isFinite(n) && n > 0) initialBillableTjmHt = n;
      }
    }
  }

  const totalToReview = transactions.length;
  const totalAmount = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const heroStats = computeDashboardHeroStats(dashboardTransactions);
  const billableTjmHt = initialBillableTjmHt ?? BILLABLE_CLIENT_TJM_HT;

  return (
    <DashboardDummyDataProvider active={dummyDataActive}>
    <BillableActivityProvider
      tjmHt={billableTjmHt}
      persistToSupabase={envMode === "SUPABASE"}
      initialWorkDayIsos={initialBillableWorkDays}
    >
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

        <DashboardPremiumHero
          stats={heroStats}
          contextMessage=""
          showContextBanner={false}
        />

        <AppSectionNav />

        <section className="mt-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-3xl border border-ink-200 bg-ink-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-300" aria-hidden />
                  <p className="mt-2 text-xs text-ink-500 dark:text-white/45">À classer</p>
                  <p className="font-display text-2xl font-bold text-ink-950 dark:text-white">{totalToReview}</p>
                </div>
                <div className="rounded-3xl border border-ink-200 bg-ink-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden />
                  <p className="mt-2 text-xs text-ink-500 dark:text-white/45">Montant</p>
                  <p className="font-display text-2xl font-bold text-ink-950 dark:text-white">
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0
                    }).format(totalAmount)}
                  </p>
                </div>
              </div>
        </section>

        <main className="mt-5">
          {loadError ? (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-800 dark:text-rose-200">
              {loadError}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-900 dark:text-amber-100">
              Aucune catégorie Bankin de référence trouvée. Importe d’abord un export Bankin pour construire la liste.
            </div>
          ) : (
            <CategorisationClient transactions={transactions} categories={categories} />
          )}
        </main>
      </div>
    </BillableActivityProvider>
    </DashboardDummyDataProvider>
  );
}
