import { clsx } from "clsx";

/** Carte compacte (filtres, contrôles) — light + dark comme le hero / Valeur réelle. */
export const dashboardAnalysisShell = clsx(
  "rounded-3xl border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-sky-50/20 p-3 text-ink-900 shadow-sm",
  "dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:text-white",
  "dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)]"
);

/** Panneau principal analytics (donut, liste, graphique). */
export const dashboardPremiumPanel = clsx(
  "rounded-[2rem] border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-sky-50/25 p-4 text-ink-900 shadow-sm backdrop-blur-2xl sm:p-5",
  "dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:text-white",
  "dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)]"
);

export const dashboardPeriodNavBtn = clsx(
  "grid h-7 w-7 place-items-center rounded-full border border-ink-200/80 text-ink-500 transition",
  "hover:border-ink-300 hover:text-ink-900",
  "dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:text-white"
);

export const dashboardPeriodTitle = "text-sm font-bold text-ink-900 dark:text-white";

export const dashboardEyebrow =
  "text-[10px] font-bold uppercase tracking-[0.24em] text-ink-500 dark:text-white/42";

export const dashboardPanelTitle =
  "font-display text-lg font-bold tracking-tight text-ink-900 dark:text-white";

export const dashboardPanelSub = "text-[11px] font-medium text-ink-500 dark:text-white/42";

export const dashboardInsetPanel = clsx(
  "rounded-2xl border border-ink-200/80 bg-ink-50/70",
  "dark:border-cyan-100/[0.10] dark:bg-white/[0.04]"
);

export const dashboardGaugeTrack = clsx(
  "relative overflow-hidden rounded-full border border-ink-200/70 bg-ink-100/80 p-1 shadow-inner",
  "dark:border-cyan-100/[0.10] dark:bg-white/[0.04]"
);

export const dashboardChartSurface = clsx(
  "dashboard-chart-surface relative h-60 overflow-hidden rounded-3xl border border-ink-200/80",
  "bg-gradient-to-b from-sky-50/70 via-white to-white px-4 pb-5 pt-4 shadow-sm",
  "dark:border-cyan-100/[0.18] dark:bg-[#0d2b38] dark:bg-none",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_54px_-34px_rgba(103,232,249,0.75)]"
);

export const dashboardDonutTrack = "text-ink-200 dark:text-[#284556]";

export const dashboardRowDivider = "border-b border-ink-200/70 py-3 last:border-0 dark:border-cyan-100/[0.08]";

export const dashboardRowTitle = "block truncate text-sm font-semibold text-ink-800 dark:text-white";

export const dashboardRowMeta = "mt-0.5 block text-xs font-medium text-ink-500 dark:text-white/48";

export const dashboardRowAmount = "block text-sm font-semibold tabular-nums text-ink-900 dark:text-white";

export const dashboardEmptyState = "py-10 text-center text-sm font-medium text-ink-500 dark:text-white/42";

export function dashboardSegmentShell(className?: string) {
  return clsx(
    "grid rounded-2xl border border-ink-200/80 bg-ink-50/60 p-1",
    "dark:border-cyan-100/[0.10] dark:bg-white/[0.04]",
    className
  );
}

export function dashboardSegmentBtn(active: boolean) {
  return clsx(
    "rounded-xl px-2 py-2 text-center text-xs font-bold transition sm:px-3",
    active
      ? "bg-brand-500 text-white shadow-sm dark:shadow-[0_8px_24px_-14px_rgba(79,126,234,0.9)]"
      : "text-ink-500 hover:text-ink-800 dark:text-white/40 dark:hover:text-white/70"
  );
}

export function dashboardFilterPill(active: boolean) {
  return clsx(
    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold leading-none shadow-sm transition",
    active
      ? "border-brand-300 bg-brand-50 text-brand-900 dark:border-white/24 dark:bg-white/[0.15] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-white/[0.08] dark:bg-white/[0.055] dark:text-white/70 dark:hover:border-white/16 dark:hover:bg-white/[0.09] dark:hover:text-white"
  );
}
