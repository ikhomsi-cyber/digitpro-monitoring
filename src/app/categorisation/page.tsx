import Link from "next/link";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { Logo } from "@/components/ui/Logo";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";
import {
  categorisationMonthBounds,
  currentCategorisationMonthKey,
  mapCategorisationCandidateRows,
  normalizeCategory,
  type CategorisationCandidateRow
} from "@/lib/categorisation-candidates";
import { ArrowLeft } from "lucide-react";
import { CategorisationClient, type CategorisationTx } from "./CategorisationClient";
import { DashboardDesktopSidebar, DashboardFloatingDock } from "@/components/dashboard/DashboardFloatingDock";
import { DashboardDummyDataProvider } from "@/components/dashboard/DashboardDisplayFormatContext";
import { formatDashboardMonthLabel } from "@/lib/dashboard-period";
import { isDashboardDummyDataActive } from "@/lib/dashboard-dummy-data-preference";

export const dynamic = "force-dynamic";

export default async function CategorisationPage() {
  const envMode = getSupabaseRuntimeMode();
  const cookieStore = await cookies();
  const supabase = envMode === "SUPABASE" ? await createSupabaseServerClient() : null;
  const user = !supabase ? null : (await supabase.auth.getUser()).data.user;
  const dummyDataActive = isDashboardDummyDataActive(cookieStore);

  if (envMode === "SUPABASE" && !user) {
    return (
      <div data-page="categorisation" className="premium-dashboard-page flex min-h-dvh items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Logo className="mx-auto mb-8" />
          <h1 className="h-display">Connexion requise</h1>
          <p className="mt-4 text-ink-600 dark:text-white/55">Connectez-vous pour catégoriser les transactions Powens.</p>
          <div className="mt-8">
            <Link href={`/login?next=${encodeURIComponent("/categorisation")}`} className="premium-cta inline-flex">
              Connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  let categories: string[] = [];
  let transactions: CategorisationTx[] = [];
  let loadError: string | null = null;
  const monthKey = currentCategorisationMonthKey();

  if (supabase) {
    const { startIso, endIso } = categorisationMonthBounds(monthKey);
    const [categoryRes, txRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("category,import_sessions!inner(format)")
        .eq("import_sessions.format", "bankin")
        .order("category", { ascending: true }),
      supabase
        .from("transactions")
        .select("id,date,label,amount,company,bank_name,category,import_sessions!inner(format)")
        .eq("import_sessions.format", "powens")
        .lt("amount", 0)
        .gte("date", startIso)
        .lte("date", endIso)
        .order("date", { ascending: false })
        .limit(200)
    ]);

    if (categoryRes.error || txRes.error) {
      loadError = categoryRes.error?.message ?? txRes.error?.message ?? "Chargement impossible.";
    } else {
      categories = buildBankinReferenceCategoryList(
        (categoryRes.data ?? []).map((row) => normalizeCategory((row as { category?: unknown }).category))
      );
      transactions = mapCategorisationCandidateRows(
        (txRes.data ?? []) as unknown as CategorisationCandidateRow[],
        monthKey
      );
    }
  }

  return (
    <DashboardDummyDataProvider active={dummyDataActive}>
      <DashboardDesktopSidebar />
      <div data-page="categorisation" className="premium-dashboard-page mx-auto max-w-6xl px-4 pb-28 pt-[max(1.5rem,calc(env(safe-area-inset-top)+1rem))] sm:px-6 md:pb-10 md:pt-[max(0.75rem,env(safe-area-inset-top))] lg:ml-32 lg:mr-auto lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-ink-900 dark:text-white/45 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Retour dashboard
        </Link>

        <main className="mt-4">
          {loadError ? (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-800 dark:text-rose-200">
              {loadError}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-3xl border border-ink-200/70 bg-white p-5 text-sm text-ink-700 shadow-card dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 dark:shadow-none">
              Aucune catégorie Bankin de référence trouvée. Importe d’abord un export Bankin pour construire la liste.
            </div>
          ) : (
            <CategorisationClient
              transactions={transactions}
              categories={categories}
              monthKey={monthKey}
              monthLabel={formatDashboardMonthLabel(monthKey)}
            />
          )}
        </main>
        <DashboardFloatingDock />
      </div>
    </DashboardDummyDataProvider>
  );
}
