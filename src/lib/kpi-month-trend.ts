export type KpiTrendDirection = "up" | "down" | "flat";

export type KpiTrend = {
  pct: number;
  label: string;
  direction: KpiTrendDirection;
  /** When true, an increase is shown in green; when false, in red. */
  positiveIsGood: boolean;
};

export type ComputeKpiTrendOptions = {
  positiveIsGood?: boolean;
};

/** Month-over-month % change between two values (current vs previous month). */
export function computeKpiTrend(
  current: number,
  previous: number,
  options: ComputeKpiTrendOptions = {}
): KpiTrend | null {
  const positiveIsGood = options.positiveIsGood ?? true;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;

  if (previous === 0 && current === 0) {
    return { pct: 0, label: "0%", direction: "flat", positiveIsGood };
  }

  if (previous === 0) {
    return { pct: 100, label: "+100%", direction: "up", positiveIsGood };
  }

  const rawPct = ((current - previous) / Math.abs(previous)) * 100;
  const pct = Math.round(rawPct);
  const direction: KpiTrendDirection = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const label = `${pct > 0 ? "+" : ""}${pct}%`;

  return { pct, label, direction, positiveIsGood };
}

export function kpiTrendIsFavorable(trend: KpiTrend): boolean {
  if (trend.direction === "flat") return true;
  return trend.direction === "up" ? trend.positiveIsGood : !trend.positiveIsGood;
}
