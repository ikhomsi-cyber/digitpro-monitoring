import Link from "next/link";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { Logo } from "@/components/ui/Logo";
import { BANKIN_UNCATEGORIZED_CATEGORY } from "@/lib/bankin/categorize";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";
import {
  mapCategorisationCandidateRows,
  normalizeCategory,
  type CategorisationCandidateRow
} from "@/lib/categorisation-candidates";
import { CategorisationClient, type CategorisationTx } from "./CategorisationClient";
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { DashboardDesktopSidebar, DashboardFloatingDock } from "@/components/dashboard/DashboardFloatingDock";
import { DashboardDummyDataProvider } from "@/components/dashboard/DashboardDisplayFormatContext";
import { isDashboardDummyDataActive } from "@/lib/dashboard-dummy-data-preference";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";

export const dynamic = "force-dynamic";

export default async function CategorisationPage() {
  const envMode = getSupabaseRuntimeMode();
  const cookieStore = await cookies();
  const supabase = envMode === "SUPABASE" ? await createSupabaseServerClient() : null;
  const user = !supabase ? null : (await supabase.auth.getUser()).data.user;
  const dummyDataActive = isDashboardDummyDataActive(cookieStore);
  const showDarkModeToggle = isDarkModeUiEnabled();

  if (envMode === "SUPABASE" && !user) {
    return (
      <div className="premium-dashboard-page flex min-h-dvh items-center justify-center px-6 py-24">
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

  if (supabase) {
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
        .eq("category", BANKIN_UNCATEGORIZED_CATEGORY)
        .order("date", { ascending: false })
        .limit(200)
    ]);

    if (categoryRes.error || txRes.error) {
      loadError = categoryRes.error?.message ?? txRes.error?.message ?? "Chargement impossible.";
    } else {
      categories = buildBankinReferenceCategoryList(
        (categoryRes.data ?? []).map((row) => normalizeCategory((row as { category?: unknown }).category))
      );
      transactions = mapCategorisationCandidateRows((txRes.data ?? []) as unknown as CategorisationCandidateRow[]);
    }
  }

  return (
    <DashboardDummyDataProvider active={dummyDataActive}>
      <DashboardDesktopSidebar />
      <div className="premium-dashboard-page mx-auto max-w-6xl px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:pb-10 lg:ml-32 lg:mr-auto lg:px-8">
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
        <DashboardFloatingDock />
      </div>
    </DashboardDummyDataProvider>
  );
}
