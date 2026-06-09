import { buildYearRevenueCapacityDaySet } from "@/lib/dashboard-metrics";
import {
  resolveBillableTjmForClientMonth,
  type BillableRatePeriod
} from "@/lib/billable-client-days";

export type YearEndConfidenceLevel = "high" | "medium" | "low";

export type YearEndProjection = {
  year: number;
  forecastDateLabel: string;
  projectedRevenueHtEur: number;
  projectedPersonalIncomeEur: number;
  projectedCsgEur: number;
  projectedCashEur: number;
  confidence: {
    level: YearEndConfidenceLevel;
    score: number;
    label: string;
  };
  detail: {
    ytdCapacityDays: number;
    remainingCapacityDays: number;
    totalCapacityDays: number;
    explicitPlannedDays: number;
    basisLabel: string;
  };
};

function localTodayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolveConfidence(
  ytdCapacityDays: number,
  totalCapacityDays: number,
  explicitPlannedDays: number,
  statsReady: boolean
): YearEndProjection["confidence"] {
  const yearProgress = totalCapacityDays > 0 ? ytdCapacityDays / totalCapacityDays : 0;
  const explicitRatio = totalCapacityDays > 0 ? explicitPlannedDays / totalCapacityDays : 0;

  let score = 0;
  if (statsReady) score += 20;
  score += Math.round(yearProgress * 50);
  score += Math.round(explicitRatio * 30);
  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return { level: "high", score, label: "Élevée" };
  if (score >= 45) return { level: "medium", score, label: "Moyenne" };
  return { level: "low", score, label: "Faible" };
}

/**
 * Projection au 31/12 : activité planifiée (jours cochés + ouvrés restants) × TJM,
 * avec répartition BNC / Perso / CSG du mois courant.
 */
export function computeYearEndProjection(input: {
  selectedWorkDayIsos: readonly string[];
  billableRatePeriods: readonly BillableRatePeriod[];
  fallbackTjmHt: number;
  clientName?: string;
  tjmRepartition: {
    caHtEur: number;
    bncEur: number;
    fraisPersoEur: number;
    csgEur: number;
  };
  soldeQontoEur: number | null;
  detteTotaleEur: number;
  statsReady: boolean;
  now?: Date;
}): YearEndProjection {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const todayIso = localTodayIso(now);
  const yearPrefix = `${year}-`;
  const clientName = input.clientName ?? input.billableRatePeriods[0]?.clientName ?? "";

  const selectedInYear = new Set(
    input.selectedWorkDayIsos.filter((iso) => iso.startsWith(yearPrefix))
  );
  const capacitySet = buildYearRevenueCapacityDaySet(year, selectedInYear);
  const sortedCapacity = [...capacitySet].sort();

  const caBase = Math.max(0, input.tjmRepartition.caHtEur);
  const bncRatio = caBase > 0 ? input.tjmRepartition.bncEur / caBase : 0;
  const persoRatio = caBase > 0 ? input.tjmRepartition.fraisPersoEur / caBase : 0;
  const csgRatio = caBase > 0 ? input.tjmRepartition.csgEur / caBase : 0;
  const personalRatio = bncRatio + persoRatio;

  const tjmCache = new Map<string, number>();
  let projectedRevenueHtEur = 0;
  let projectedPersonalIncomeEur = 0;
  let projectedCsgEur = 0;
  let ytdCapacityDays = 0;
  let remainingCapacityDays = 0;
  let remainingPersonalIncomeEur = 0;
  let remainingCsgEur = 0;

  for (const iso of sortedCapacity) {
    const monthKey = iso.slice(0, 7);
    let tjmHt = tjmCache.get(monthKey);
    if (tjmHt == null) {
      tjmHt = resolveBillableTjmForClientMonth(
        input.billableRatePeriods,
        clientName,
        monthKey,
        input.fallbackTjmHt
      );
      tjmCache.set(monthKey, tjmHt);
    }

    projectedRevenueHtEur += tjmHt;
    projectedPersonalIncomeEur += tjmHt * personalRatio;
    projectedCsgEur += tjmHt * csgRatio;

    if (iso <= todayIso) {
      ytdCapacityDays++;
    } else {
      remainingCapacityDays++;
      remainingPersonalIncomeEur += tjmHt * personalRatio;
      remainingCsgEur += tjmHt * csgRatio;
    }
  }

  const cashBase = input.soldeQontoEur ?? 0;
  const netCashTodayEur = cashBase - input.detteTotaleEur;
  const projectedCashEur = netCashTodayEur + remainingPersonalIncomeEur - remainingCsgEur;

  const forecastDateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(year, 11, 31));

  return {
    year,
    forecastDateLabel,
    projectedRevenueHtEur: round2(projectedRevenueHtEur),
    projectedPersonalIncomeEur: round2(projectedPersonalIncomeEur),
    projectedCsgEur: round2(projectedCsgEur),
    projectedCashEur: round2(projectedCashEur),
    confidence: resolveConfidence(
      ytdCapacityDays,
      sortedCapacity.length,
      selectedInYear.size,
      input.statsReady
    ),
    detail: {
      ytdCapacityDays,
      remainingCapacityDays,
      totalCapacityDays: sortedCapacity.length,
      explicitPlannedDays: selectedInYear.size,
      basisLabel: "TJM × jours planifiés (cochés + ouvrés restants)"
    }
  };
}
