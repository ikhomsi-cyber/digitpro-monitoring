"use client";

import { clsx } from "clsx";
import { kpiTrendIsFavorable, type KpiTrend } from "@/lib/kpi-month-trend";

type Props = {
  trend: KpiTrend | null | undefined;
  className?: string;
  title?: string;
};

export function KpiTrendBadge({ trend, className, title = "vs mois précédent" }: Props) {
  if (!trend) return null;

  const favorable = kpiTrendIsFavorable(trend);
  const arrow = trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "•";

  return (
    <span
      title={title}
      className={clsx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums tracking-tight",
        trend.direction === "flat"
          ? "bg-ink-50 text-ink-500 dark:bg-white/[0.06] dark:text-white/45"
          : favorable
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
        className
      )}
    >
      <span aria-hidden>{arrow}</span>
      <span>{trend.label}</span>
    </span>
  );
}
