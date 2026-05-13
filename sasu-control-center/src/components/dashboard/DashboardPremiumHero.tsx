import Link from "next/link";
import { formatEur } from "@/lib/format";
import type { DashboardHeroStats } from "@/lib/dashboard-hero-stats";

type Props = {
  stats: DashboardHeroStats;
  /** Bandeau contexte (démo / préférence démo). */
  contextMessage: string;
  showContextBanner: boolean;
};

export function DashboardPremiumHero({ stats, contextMessage, showContextBanner }: Props) {
  const chips = "SASU · LMNP · Cashflow · Fiscalité";

  const tiles = [
    { label: "CA mensuel", value: formatEur(stats.caMensuelEur) },
    {
      label: "Solde Qonto",
      value: stats.soldeQontoEur != null ? formatEur(stats.soldeQontoEur) : "—"
    },
    { label: "Dépenses du mois (Qonto)", value: formatEur(stats.depensesQontoSasuMoisEur) },
    { label: "TJM (indicatif)", value: formatEur(stats.tjmAfficheEur) }
  ];

  return (
    <header className="relative mx-auto mt-6 max-w-6xl overflow-hidden rounded-3xl border border-ink-200/80 bg-gradient-to-b from-white via-white to-ink-50/80 px-5 py-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.15)] dark:border-white/[0.07] dark:from-[#0f1412] dark:via-[#0a0d0c] dark:to-[#050505] dark:shadow-[0_32px_100px_-20px_rgba(0,0,0,0.75)] sm:px-8 sm:py-10">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/15"
        aria-hidden
      />

      <div className="relative text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ink-500 dark:text-emerald-300/80">
          DigitPro Monitoring
        </p>
        {showContextBanner ? (
          <p className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-50">
            {contextMessage}
          </p>
        ) : null}
        <h1 className="mx-auto mt-4 max-w-3xl text-balance font-display text-3xl font-semibold leading-[1.08] tracking-apple-tight text-ink-900 dark:text-white sm:text-4xl md:text-[2.65rem]">
          Pilotage finances, trésorerie et chiffre d’affaires en temps réel.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-sm text-ink-600 dark:text-white/55 sm:text-base">
          {chips}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="#dashboard-main" className="premium-cta inline-flex items-center justify-center">
            Ouvrir le dashboard
          </Link>
          <span className="text-xs text-ink-500 dark:text-white/35">Accès direct aux indicateurs</span>
        </div>

        <dl className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-2xl border border-ink-200/80 bg-white/70 px-3 py-3 text-left shadow-sm dark:border-white/[0.06] dark:bg-white/[0.04] dark:shadow-none sm:px-4 sm:py-4"
            >
              <dt className="text-[11px] font-medium text-ink-500 dark:text-white/45">{t.label}</dt>
              <dd className="mt-1.5 font-display text-lg font-semibold tabular-nums tracking-tight text-ink-900 dark:text-white sm:text-xl">
                {t.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-xs text-ink-400 dark:text-white/30">by Iliass KHOMSI</p>
      </div>
    </header>
  );
}
