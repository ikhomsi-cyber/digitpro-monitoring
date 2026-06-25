import { clsx } from "clsx";

/** Espacement section — aligné sur `gap-4` des cartes insight (Dépenses / Entrées). */
export const dashboardSectionStack = "space-y-4";

/** Séparateur horizontal entre blocs d'une même page. */
export const dashboardSectionDivider = clsx(
  "border-t border-ink-200/45 pt-5 dark:border-cyan-100/[0.07] sm:pt-6"
);

/** En-tête de section (titre + sous-titre). */
export const dashboardFlatSectionHeader = clsx(
  "border-b border-ink-200/45 pb-4 dark:border-cyan-100/[0.08]"
);

/** Zone hero / intro — pas de fond ni bordure. */
export const dashboardFlatHero = "relative w-full";

/** Bloc hero centré (Cash disponible, CA sécurisé, etc.). */
export const dashboardHeroSection =
  "flex flex-col items-center py-6 text-center sm:py-8";

/** Carte insight style Revolut (analyse, projection). */
export const dashboardInsightCard =
  "flex min-w-0 flex-col rounded-3xl border border-ink-200/70 bg-white p-5 shadow-card dark:border-white/[0.06] dark:bg-white/[0.04] dark:shadow-none";

/** Grille 2 colonnes pour cartes insight (sans séparateurs verticaux). */
export const dashboardInsightGrid = "grid grid-cols-1 gap-4 sm:grid-cols-2";

/** Cellule KPI — typographie seule, sans carte. */
export const dashboardFlatKpi = "flex h-full min-h-0 flex-col py-2 text-left sm:py-3";

/** Grille KPI dense — plusieurs indicateurs par ligne. */
export function dashboardDenseKpiGrid(columns: 2 | 3 | 4) {
  return clsx(
    "grid items-stretch gap-x-4 gap-y-4 sm:gap-x-5",
    columns === 2 && "grid-cols-1 md:grid-cols-2",
    columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    columns === 4 && "grid-cols-2 lg:grid-cols-4",
    "lg:[&>*:not(:last-child)]:border-r lg:[&>*:not(:last-child)]:border-ink-200/35 lg:[&>*:not(:last-child)]:pr-5",
    "dark:lg:[&>*:not(:last-child)]:border-cyan-100/[0.07]"
  );
}

/** Grille 2 colonnes pour blocs analytiques (waterfalls, graphiques). */
export const dashboardTwoColGrid = "grid gap-5 lg:grid-cols-2 lg:gap-6 lg:items-start";

/** Filtres / contrôles compacts — fond page. */
export const dashboardAnalysisShell = clsx("space-y-4 text-ink-900 dark:text-white");

/** Panneau analytics principal — fond page. */
export const dashboardPremiumPanel = clsx("space-y-5 text-ink-900 dark:text-white");

export const dashboardPeriodNavBtn = clsx(
  "grid h-7 w-7 place-items-center rounded-full border border-ink-200/80 text-ink-500 transition",
  "hover:border-ink-300 hover:text-ink-900",
  "dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white"
);

export const dashboardPeriodTitle = "text-sm font-bold text-ink-900 dark:text-white";

export const dashboardEyebrow =
  "text-[10px] font-bold uppercase tracking-[0.24em] text-ink-500 dark:text-white/42";

/** Titre de section KPI — une seule couleur, pas d'accent chromatique. */
export const dashboardSectionTitle = clsx(
  "border-b border-ink-200/70 pb-1.5 text-[10px] font-bold uppercase tracking-[0.24em]",
  "text-ink-600 dark:border-cyan-100/[0.10] dark:text-white/50"
);

export const dashboardPanelTitle =
  "font-display text-lg font-bold tracking-tight text-ink-900 dark:text-white";

export const dashboardPanelSub = "text-[11px] font-medium text-ink-500 dark:text-white/42";

/** Encart léger — bordure seule, fond transparent. */
export const dashboardInsetPanel = clsx(
  "rounded-xl border border-ink-200/40",
  "dark:border-cyan-100/[0.08]"
);

export const dashboardGaugeTrack = clsx(
  "relative overflow-hidden rounded-full border border-ink-200/50 bg-ink-100/50 p-1",
  "dark:border-cyan-100/[0.08] dark:bg-white/[0.03]"
);

export const dashboardChartSurface = clsx(
  "dashboard-chart-surface relative h-60 overflow-hidden rounded-2xl border border-ink-200/60 bg-white px-4 pb-5 pt-4 shadow-sm",
  "dark:border-cyan-100/[0.10] dark:bg-transparent dark:shadow-none"
);

export const dashboardDonutTrack = "text-ink-200 dark:text-[#284556]";

export const dashboardRowDivider = "border-b border-ink-200/50 py-3 last:border-0 dark:border-cyan-100/[0.07]";

export const dashboardRowTitle = "block truncate text-sm font-semibold text-ink-800 dark:text-white";

export const dashboardRowMeta = "mt-0.5 block text-xs font-medium text-ink-500 dark:text-white/48";

export const dashboardRowAmount = "block text-sm font-semibold tabular-nums text-ink-900 dark:text-white";

export const dashboardEmptyState = "py-10 text-center text-sm font-medium text-ink-500 dark:text-white/42";

export function dashboardSegmentShell(className?: string) {
  return clsx(
    "grid rounded-xl border border-ink-200/40 p-0.5",
    "dark:border-cyan-100/[0.08]",
    className
  );
}

export function dashboardSegmentBtn(active: boolean) {
  return clsx(
    "rounded-lg px-2 py-2 text-center text-xs font-bold transition sm:px-3",
    active
      ? "bg-brand-500 text-white shadow-sm dark:shadow-[0_8px_24px_-14px_rgba(79,126,234,0.9)]"
      : "text-ink-500 hover:text-ink-800 dark:text-white/40 dark:hover:text-white/70"
  );
}

export function dashboardFilterPill(active: boolean) {
  return clsx(
    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold leading-none transition",
    active
      ? "border-brand-300 bg-brand-50 text-brand-900 dark:border-white/24 dark:bg-white/[0.12] dark:text-white"
      : "border-ink-200/70 bg-transparent text-ink-600 hover:border-ink-300 hover:bg-ink-50/50 dark:border-white/[0.08] dark:text-white/70 dark:hover:border-white/16 dark:hover:text-white"
  );
}

export function dashboardFilterPillAmount(active: boolean) {
  return clsx(
    "rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
    active
      ? "border-brand-300/60 bg-brand-200/75 text-brand-900 dark:border-cyan-100/24 dark:bg-white/[0.18] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "border-transparent bg-ink-100 text-ink-600 dark:border-cyan-100/[0.14] dark:bg-white/[0.10] dark:text-cyan-50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
  );
}
