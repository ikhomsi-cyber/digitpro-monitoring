import Link from "next/link";
import { ArrowLeft, CreditCard, Sparkles, Tags } from "lucide-react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { Logo } from "@/components/ui/Logo";
import { BANKIN_UNCATEGORIZED_CATEGORY } from "@/lib/bankin/categorize";
import { buildBankinReferenceCategoryList } from "@/lib/bankin/reference-categories";
import { CategorisationClient, type CategorisationTx } from "./CategorisationClient";
import { DashboardTopNav } from "@/components/dashboard/DashboardTopNav";
import { AppSectionNav } from "@/components/AppSectionNav";
import { DashboardDummyDataProvider } from "@/components/dashboard/DashboardDisplayFormatContext";
import { isDashboardDummyDataActive } from "@/lib/dashboard-dummy-data-preference";
import { isDarkModeUiEnabled } from "@/lib/dark-mode-flag";

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
  }

  const totalToReview = transactions.length;
  const totalAmount = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

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

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-ink-200 bg-white shadow-[0_16px_60px_-28px_rgba(0,0,0,0.28)] dark:border-white/[0.08] dark:bg-gradient-to-b dark:from-[#101412] dark:via-[#080a09] dark:to-[#050505]">
          <div className="relative p-5 sm:p-7">
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-400/15" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <Link
                  href="/dashboard?panel=valeur-reelle"
                  className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-ink-500 transition hover:text-ink-900 dark:text-white/45 dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Retour dashboard
                </Link>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
                    <Tags className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
                      Categorisation
                    </p>
                    <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink-950 dark:text-white">
                      Revue des paiements carte Powens
                    </h1>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink-600 dark:text-white/55">
                  On ne te montre ici que les transactions Powens non identifiées qui ressemblent à des paiements carte
                  ou CB. Les virements, prélèvements et mouvements bancaires automatiques restent hors de cette revue.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[22rem]">
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
    </DashboardDummyDataProvider>
  );
}
