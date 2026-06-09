import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  getAnalyticsMonthKeysForYears,
  last12MonthsKeys
} from "@/lib/dashboard-metrics";
import {
  dashboardMonthKeyNowLocal,
  formatDashboardMonthLabel,
  formatDashboardPeriodLabelWithMonth
} from "@/lib/dashboard-period";
import { analyzeValeurReelle } from "@/lib/valeur-reelle-analyze";

export type ValeurReelleMonthlyTrendFilter = {
  years: number[] | null;
  month: string | null;
};

export type ValeurReelleMonthlyTrendHighlight = "best" | "worst" | "selected" | null;

export type ValeurReelleMonthlyTrendPoint = {
  monthKey: string;
  /** Libellé court pour l’axe X (ex. « janv. »). */
  label: string;
  /** Libellé complet pour infobulle (ex. « janvier 2026 »). */
  fullLabel: string;
  caFactureEur: number;
  /** Net disponible réel = BNC payé + frais perso réintégrés. */
  netRetainedEur: number;
  highlight: ValeurReelleMonthlyTrendHighlight;
};

export type ValeurReelleMonthlyTrendSeries = {
  points: ValeurReelleMonthlyTrendPoint[];
  periodLabel: string;
  bestMonthKey: string | null;
  worstMonthKey: string | null;
  /** Meilleur / pire déterminés uniquement sur le net disponible réel (métrique hero). */
  highlightMetric: "netRetainedEur";
};

function shortMonthLabel(monthKey: string): string {
  const y = Number(monthKey.slice(0, 4));
  const m = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(y, m - 1, 1));
}

/** Mois civils affichables : pas au-delà du mois en cours. */
function resolveTrendMonthKeys(
  filter: ValeurReelleMonthlyTrendFilter,
  now = new Date()
): string[] {
  const currentKey = dashboardMonthKeyNowLocal(now);
  const keys =
    filter.years != null && filter.years.length > 0
      ? getAnalyticsMonthKeysForYears(filter.years)
      : last12MonthsKeys(now);
  return keys.filter((key) => key <= currentKey);
}

function netRetainedFromTree(tree: ReturnType<typeof analyzeValeurReelle>["cashTree"]): number {
  return Math.round((tree.bncEur + tree.personalChargesEur) * 100) / 100;
}

/**
 * Série mensuelle CA HT + net disponible réel pour comparaison inter-mois.
 * Respecte le filtre années (ou 12 mois glissants si « toutes les années »).
 * Le filtre mois unique sert au surlignage, pas à restreindre la série.
 */
export function buildValeurReelleMonthlyTrendSeries(
  transactions: readonly DashboardTx[],
  filter: ValeurReelleMonthlyTrendFilter,
  now = new Date()
): ValeurReelleMonthlyTrendSeries {
  const monthKeys = resolveTrendMonthKeys(filter, now);
  const periodLabel = formatDashboardPeriodLabelWithMonth(filter.years, filter.month);

  const rawPoints = monthKeys.map((monthKey) => {
    const analysis = analyzeValeurReelle(transactions, { years: null, month: monthKey, now });
    return {
      monthKey,
      label: shortMonthLabel(monthKey),
      fullLabel: formatDashboardMonthLabel(monthKey),
      caFactureEur: analysis.cashTree.caFactureEur,
      netRetainedEur: netRetainedFromTree(analysis.cashTree),
      highlight: null as ValeurReelleMonthlyTrendHighlight
    };
  });

  const comparable = rawPoints.filter((p) => p.caFactureEur > 0 || p.netRetainedEur !== 0);
  let bestMonthKey: string | null = null;
  let worstMonthKey: string | null = null;

  if (comparable.length > 0) {
    let bestNet = -Infinity;
    let worstNet = Infinity;
    for (const point of comparable) {
      if (point.netRetainedEur > bestNet) {
        bestNet = point.netRetainedEur;
        bestMonthKey = point.monthKey;
      }
      if (point.netRetainedEur < worstNet) {
        worstNet = point.netRetainedEur;
        worstMonthKey = point.monthKey;
      }
    }
  }

  const points = rawPoints.map((point) => {
    let highlight: ValeurReelleMonthlyTrendHighlight = null;
    if (filter.month && point.monthKey === filter.month) {
      highlight = "selected";
    } else if (point.monthKey === bestMonthKey && point.monthKey === worstMonthKey) {
      highlight = "best";
    } else if (point.monthKey === bestMonthKey) {
      highlight = "best";
    } else if (point.monthKey === worstMonthKey) {
      highlight = "worst";
    }
    return { ...point, highlight };
  });

  return {
    points,
    periodLabel,
    bestMonthKey,
    worstMonthKey,
    highlightMetric: "netRetainedEur"
  };
}
