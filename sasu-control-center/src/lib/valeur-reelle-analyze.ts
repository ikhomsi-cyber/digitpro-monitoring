import { bankinSubcategoryLabel } from "@/lib/bankin/categorize";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  filterDashboardTransactions,
  isPersonalInternalTransferMovement,
  last12MonthsKeys,
  type DashboardAnalyticsFilter
} from "@/lib/dashboard-metrics";
import { formatDashboardPeriodLabel } from "@/lib/dashboard-period";
import { deriveExpenseBucket, type DerivedExpenseBucket } from "@/lib/derived-expense-bucket";
import { matchesLoyersRecusSubcategory } from "@/lib/lmnp-analyze";
import { isRevenueCategory } from "@/lib/revenue-category";
import {
  formatHiddenValueSublabel,
  formatRealExpenseSublabel,
  blobMatchesMixedExpense,
  hiddenValueRecoveryRatio,
  isRetraiteExpense,
  KIND_BY_GROUP,
  LEASING_KEYWORDS,
  MIXED_RECOVERY_PERCENT,
  PASSIVE_INCOME_KEYWORDS,
  REAL_EXPENSE_BUCKETS,
  resolveActiveIncomeCategory,
  resolveHiddenValueCategory,
  resolveMixedCategory,
  resolvePassiveIncomeCategory,
  resolveRealExpenseCategory,
  TAX_BUCKETS,
  VALEUR_REELLE_GROUP_META,
  type ValeurReelleClassification,
  type ValeurReelleGroup,
  type ValeurReelleKind
} from "@/lib/valeur-reelle-config";

/** Taux d’imposition par défaut sur le BNC brut si aucun IR constaté sur la période. */
export const DEFAULT_IR_ON_BNC_RATE = 0.3;

function fold(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function txBlob(tx: DashboardTx): string {
  return fold(`${tx.label} ${tx.company} ${tx.category}`);
}

function blobHasKeyword(b: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => b.includes(fold(kw)));
}

function isProScope(tx: DashboardTx): boolean {
  return (tx.scope ?? "pro") === "pro";
}

export type ClassifiedValeurReelleMovement = {
  id: string;
  date: string;
  label: string;
  category: string;
  amount: number;
  group: ValeurReelleGroup;
  kind: ValeurReelleKind;
  bucket: DerivedExpenseBucket | null;
  /** Libellé métier affiché (catégorie). */
  sublabel: string;
  score: number;
  recoveredValuePercent: number;
  recoveryRatio: number;
  hiddenValueEur: number;
  tooltip: string;
};

export type ValeurReelleCategoryRow = {
  key: string;
  label: string;
  group: ValeurReelleGroup;
  kind: ValeurReelleKind;
  totalEur: number;
  count: number;
  hiddenValueEur: number;
};

export type ValeurReelleWaterfallBreakdownRow = {
  label: string;
  amountEur: number;
  count: number;
};

export type ValeurReelleWaterfallStep = {
  id: string;
  label: string;
  deltaEur: number;
  cumulativeEur: number;
  tone: "emerald" | "rose" | "green" | "amber" | "sky";
  breakdown: ValeurReelleWaterfallBreakdownRow[];
};

type WaterfallBreakdownAccumulator = Map<string, { amountEur: number; count: number }>;

function waterfallBreakdownMap(): Map<string, WaterfallBreakdownAccumulator> {
  return new Map();
}

function addWaterfallBreakdown(
  root: Map<string, WaterfallBreakdownAccumulator>,
  stepId: string,
  label: string,
  amountEur: number
) {
  if (!amountEur) return;
  let step = root.get(stepId);
  if (!step) {
    step = new Map();
    root.set(stepId, step);
  }
  const prev = step.get(label);
  if (prev) {
    prev.amountEur += amountEur;
    prev.count += 1;
  } else {
    step.set(label, { amountEur, count: 1 });
  }
}

function materializeWaterfallBreakdown(
  root: Map<string, WaterfallBreakdownAccumulator>,
  stepId: string
): ValeurReelleWaterfallBreakdownRow[] {
  const step = root.get(stepId);
  if (!step) return [];
  return Array.from(step.entries())
    .map(([label, v]) => ({ label, amountEur: v.amountEur, count: v.count }))
    .sort((a, b) => Math.abs(b.amountEur) - Math.abs(a.amountEur));
}

export type ValeurReelleCashTree = {
  caFactureEur: number;
  chargesEtCsgEur: number;
  /** Valeur récupérée sur des charges « avantages » (IK, repas, CESU…). */
  chargesUtilesRecupereesEur: number;
  bncBrutEur: number;
  impotPayeEur: number;
  impotEstimeEur: number;
  impotUtiliseEur: number;
  impotEstime: boolean;
  netCashEur: number;
  revenusIndirectsEur: number;
  netReelEur: number;
};

export function countBillableDaysForAnalyticsFilter(
  billableIsos: readonly string[],
  years: number[] | null,
  now = new Date()
): number {
  if (years != null && years.length > 0) {
    const set = new Set(years);
    return billableIsos.filter((iso) => set.has(Number(iso.slice(0, 4)))).length;
  }
  const months = new Set(last12MonthsKeys(now));
  return billableIsos.filter((iso) => months.has(iso.slice(0, 7))).length;
}

export type ValeurReelleAnalysis = {
  year: number;
  periodLabel: string;
  cashTree: ValeurReelleCashTree;
  activeIncomeEur: number;
  passiveIncomeEur: number;
  totalRevenueEur: number;
  realExpensesEur: number;
  hiddenExpensesGrossEur: number;
  hiddenValueRecoveredEur: number;
  mixedExpensesEur: number;
  mixedValueRecoveredEur: number;
  taxesEur: number;
  realValueScoreEur: number;
  moneyConservedEur: number;
  optimizationRatePct: number;
  classifiedCount: number;
  movements: ClassifiedValeurReelleMovement[];
  categoryRows: ValeurReelleCategoryRow[];
  waterfall: ValeurReelleWaterfallStep[];
  /** @deprecated alias */
  activeRevenueEur: number;
  /** @deprecated */
  indirectBenefitsEur: number;
  /** @deprecated */
  ambiguousExpensesEur: number;
};

function toClassification(
  group: ValeurReelleGroup,
  category: string,
  recoveredValuePercent: number,
  tooltip?: string
): ValeurReelleClassification {
  const meta = VALEUR_REELLE_GROUP_META[group];
  return {
    group,
    kind: KIND_BY_GROUP[group],
    category,
    score: meta.score,
    recoveredValuePercent,
    color: meta.color,
    tooltip: tooltip ?? meta.defaultTooltip
  };
}

export function classifyValeurReelleTransaction(tx: DashboardTx): ValeurReelleClassification & {
  bucket: DerivedExpenseBucket | null;
  sublabel: string;
  recoveryRatio: number;
} {
  if (isPersonalInternalTransferMovement(tx)) {
    const c = toClassification("mixed", "Mouvement interne", 0, "Virement interne — exclu du score.");
    return { ...c, bucket: null, sublabel: c.category, recoveryRatio: 0 };
  }

  const b = txBlob(tx);
  const sub = fold(bankinSubcategoryLabel(tx.category));

  if (tx.amount > 0) {
    if (isRevenueCategory(tx.category) && isProScope(tx)) {
      const cat = resolveActiveIncomeCategory(b, sub);
      const c = toClassification("active_income", cat, 100);
      return { ...c, bucket: null, sublabel: cat, recoveryRatio: 0 };
    }

    if (
      matchesLoyersRecusSubcategory(tx) ||
      blobHasKeyword(b, PASSIVE_INCOME_KEYWORDS) ||
      blobHasKeyword(sub, PASSIVE_INCOME_KEYWORDS)
    ) {
      const cat = resolvePassiveIncomeCategory(b, sub, tx.category);
      const c = toClassification("passive_income", cat, 100);
      return { ...c, bucket: null, sublabel: cat, recoveryRatio: 0 };
    }

    if (blobHasKeyword(b, ["dividende", "coupon", "interet", "intérêt", "loyer"])) {
      const cat = resolvePassiveIncomeCategory(b, sub, tx.category);
      const c = toClassification("passive_income", cat, 100);
      return { ...c, bucket: null, sublabel: cat, recoveryRatio: 0 };
    }

    const cat = resolveActiveIncomeCategory(b, sub);
    const c = toClassification("active_income", cat, 100, "Encaissement pro classé en CA / actif.");
    return { ...c, bucket: null, sublabel: cat, recoveryRatio: 0 };
  }

  const bucket = deriveExpenseBucket(tx);

  const hiddenCat = resolveHiddenValueCategory(bucket, b, sub, tx.category);
  if (hiddenCat) {
    const pct = hiddenValueRecoveryRatio(hiddenCat) * 100;
    const c = toClassification("hidden_value", hiddenCat, pct);
    return {
      ...c,
      bucket,
      sublabel: formatHiddenValueSublabel(hiddenCat),
      recoveryRatio: hiddenValueRecoveryRatio(hiddenCat)
    };
  }

  if (blobHasKeyword(b, LEASING_KEYWORDS)) {
    const cat = resolveMixedCategory(b, bucket);
    const c = toClassification("mixed", cat, MIXED_RECOVERY_PERCENT);
    return { ...c, bucket, sublabel: cat, recoveryRatio: MIXED_RECOVERY_PERCENT / 100 };
  }

  if (REAL_EXPENSE_BUCKETS.has(bucket)) {
    const cat = resolveRealExpenseCategory(bucket, b, sub, tx.category);
    const c = toClassification("real_expense", cat, 0);
    return {
      ...c,
      bucket,
      sublabel: formatRealExpenseSublabel(cat),
      recoveryRatio: 0
    };
  }

  if (bucket === "NDF") {
    const c = toClassification("mixed", "Notes de frais", MIXED_RECOVERY_PERCENT);
    return { ...c, bucket, sublabel: c.category, recoveryRatio: MIXED_RECOVERY_PERCENT / 100 };
  }

  if (blobMatchesMixedExpense(b)) {
    const mixedCat = resolveMixedCategory(b, bucket);
    const c = toClassification("mixed", mixedCat, MIXED_RECOVERY_PERCENT);
    return { ...c, bucket, sublabel: mixedCat, recoveryRatio: MIXED_RECOVERY_PERCENT / 100 };
  }

  const cat = resolveRealExpenseCategory(bucket, b, sub, tx.category);
  const c = toClassification("real_expense", cat, 0);
  return {
    ...c,
    bucket,
    sublabel: formatRealExpenseSublabel(cat),
    recoveryRatio: 0
  };
}

export function analyzeValeurReelle(
  transactions: readonly DashboardTx[],
  options?: DashboardAnalyticsFilter & { now?: Date }
): ValeurReelleAnalysis {
  const now = options?.now ?? new Date();
  const years = options?.years ?? null;
  const periodLabel = formatDashboardPeriodLabel(years);
  const scoped = filterDashboardTransactions([...transactions], { years }, now);

  let activeIncomeEur = 0;
  let passiveIncomeEur = 0;
  let realExpensesEur = 0;
  let hiddenExpensesGrossEur = 0;
  let hiddenValueRecoveredEur = 0;
  let mixedExpensesEur = 0;
  let mixedValueRecoveredEur = 0;
  let taxesEur = 0;
  let impotPayeEur = 0;

  const movements: ClassifiedValeurReelleMovement[] = [];
  const categoryMap = new Map<string, ValeurReelleCategoryRow>();
  const waterfallBreakdown = waterfallBreakdownMap();

  for (const tx of scoped) {
    const classified = classifyValeurReelleTransaction(tx);
    const group = classified.group;
    const kind = classified.kind;
    const amtAbs = Math.abs(tx.amount);

    const hiddenValueEur =
      group === "hidden_value"
        ? amtAbs * classified.recoveryRatio
        : group === "mixed"
          ? amtAbs * classified.recoveryRatio
          : 0;

    if (group === "active_income") {
      if (!isProScope(tx)) continue;
      activeIncomeEur += tx.amount;
      addWaterfallBreakdown(waterfallBreakdown, "ca", classified.sublabel, tx.amount);
    } else if (group === "passive_income") {
      passiveIncomeEur += tx.amount;
      addWaterfallBreakdown(waterfallBreakdown, "ca", classified.sublabel, tx.amount);
    } else if (group === "real_expense") {
      if (!isProScope(tx)) continue;
      realExpensesEur += amtAbs;
      const isTaxLine =
        classified.bucket &&
        TAX_BUCKETS.has(classified.bucket) &&
        !isRetraiteExpense(classified.bucket, txBlob(tx), fold(bankinSubcategoryLabel(tx.category)), tx.category);
      if (isTaxLine) {
        taxesEur += amtAbs;
        if (classified.bucket === "Impôt") impotPayeEur += amtAbs;
        addWaterfallBreakdown(waterfallBreakdown, "impots", classified.sublabel, -amtAbs);
      } else {
        addWaterfallBreakdown(waterfallBreakdown, "charges", classified.sublabel, -amtAbs);
      }
    } else if (group === "hidden_value") {
      if (!isProScope(tx)) continue;
      hiddenExpensesGrossEur += amtAbs;
      hiddenValueRecoveredEur += hiddenValueEur;
      if (hiddenValueEur > 0) {
        addWaterfallBreakdown(waterfallBreakdown, "recupere", classified.sublabel, hiddenValueEur);
      }
    } else if (group === "mixed") {
      if (!isProScope(tx)) continue;
      mixedExpensesEur += amtAbs;
      mixedValueRecoveredEur += hiddenValueEur;
    }

    const catKey = `${group}:${classified.sublabel}`;
    const prev = categoryMap.get(catKey);
    if (prev) {
      prev.totalEur += group === "active_income" || group === "passive_income" ? tx.amount : amtAbs;
      prev.count += 1;
      prev.hiddenValueEur += hiddenValueEur;
    } else {
      categoryMap.set(catKey, {
        key: catKey,
        label: classified.sublabel,
        group,
        kind,
        totalEur: group === "active_income" || group === "passive_income" ? tx.amount : amtAbs,
        count: 1,
        hiddenValueEur
      });
    }

    movements.push({
      id: tx.id,
      date: tx.date,
      label: tx.label,
      category: tx.category,
      amount: tx.amount,
      group,
      kind,
      bucket: classified.bucket,
      sublabel: classified.sublabel,
      score: classified.score,
      recoveredValuePercent: classified.recoveredValuePercent,
      recoveryRatio: classified.recoveryRatio,
      hiddenValueEur,
      tooltip: classified.tooltip
    });
  }

  movements.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const categoryRows = Array.from(categoryMap.values()).sort(
    (a, b) => Math.abs(b.totalEur) - Math.abs(a.totalEur)
  );

  const totalRevenueEur = activeIncomeEur + passiveIncomeEur;
  const realValueScoreEur = activeIncomeEur + passiveIncomeEur + hiddenValueRecoveredEur - realExpensesEur;
  const moneyConservedEur = realValueScoreEur;

  const chargesHorsImpots = Math.max(0, realExpensesEur - taxesEur);
  const chargesEtCsgEur = chargesHorsImpots;
  const caFactureEur = activeIncomeEur;
  const bncBrutEur = Math.max(0, caFactureEur - chargesEtCsgEur);
  const impotEstimeEur = Math.round(bncBrutEur * DEFAULT_IR_ON_BNC_RATE * 100) / 100;
  const impotEstime = impotPayeEur <= 0 && bncBrutEur > 0;
  const impotUtiliseEur = impotPayeEur > 0 ? impotPayeEur : impotEstimeEur;
  const netCashEur = caFactureEur - chargesEtCsgEur - impotUtiliseEur;
  const revenusIndirectsEur = hiddenValueRecoveredEur;
  const netReelEur = netCashEur + revenusIndirectsEur;

  const cashTree: ValeurReelleCashTree = {
    caFactureEur,
    chargesEtCsgEur,
    chargesUtilesRecupereesEur: hiddenValueRecoveredEur,
    bncBrutEur,
    impotPayeEur,
    impotEstimeEur,
    impotUtiliseEur,
    impotEstime,
    netCashEur,
    revenusIndirectsEur,
    netReelEur
  };

  const optimizationDenom = realExpensesEur + hiddenValueRecoveredEur;
  const optimizationRatePct =
    optimizationDenom > 0
      ? Math.round((hiddenValueRecoveredEur / optimizationDenom) * 1000) / 10
      : 0;

  const waterfall: ValeurReelleWaterfallStep[] = [];
  let cumulative = 0;

  cumulative += totalRevenueEur;
  waterfall.push({
    id: "ca",
    label: "CA & revenus",
    deltaEur: totalRevenueEur,
    cumulativeEur: cumulative,
    tone: "emerald",
    breakdown: materializeWaterfallBreakdown(waterfallBreakdown, "ca")
  });

  cumulative -= chargesHorsImpots;
  waterfall.push({
    id: "charges",
    label: "Charges entreprise",
    deltaEur: -chargesHorsImpots,
    cumulativeEur: cumulative,
    tone: "rose",
    breakdown: materializeWaterfallBreakdown(waterfallBreakdown, "charges")
  });

  cumulative += hiddenValueRecoveredEur;
  waterfall.push({
    id: "recupere",
    label: "Avantages & flux récupérés",
    deltaEur: hiddenValueRecoveredEur,
    cumulativeEur: cumulative,
    tone: "green",
    breakdown: materializeWaterfallBreakdown(waterfallBreakdown, "recupere")
  });

  cumulative -= taxesEur;
  waterfall.push({
    id: "impots",
    label: "Impôts & cotisations",
    deltaEur: -taxesEur,
    cumulativeEur: cumulative,
    tone: "amber",
    breakdown: materializeWaterfallBreakdown(waterfallBreakdown, "impots")
  });

  waterfall.push({
    id: "final",
    label: "Valeur réelle finale",
    deltaEur: moneyConservedEur,
    cumulativeEur: moneyConservedEur,
    tone: "sky",
    breakdown: [
      { label: "CA & revenus", amountEur: totalRevenueEur, count: 0 },
      { label: "Charges entreprise", amountEur: -chargesHorsImpots, count: 0 },
      { label: "Avantages & flux récupérés", amountEur: hiddenValueRecoveredEur, count: 0 },
      { label: "Impôts & cotisations", amountEur: -taxesEur, count: 0 }
    ]
  });

  return {
    year: years?.length === 1 ? years[0]! : now.getFullYear(),
    periodLabel,
    cashTree,
    activeIncomeEur,
    passiveIncomeEur,
    totalRevenueEur,
    realExpensesEur,
    hiddenExpensesGrossEur,
    hiddenValueRecoveredEur,
    mixedExpensesEur,
    mixedValueRecoveredEur,
    taxesEur,
    realValueScoreEur,
    moneyConservedEur,
    optimizationRatePct,
    classifiedCount: movements.length,
    movements,
    categoryRows,
    waterfall,
    activeRevenueEur: activeIncomeEur,
    indirectBenefitsEur: hiddenValueRecoveredEur,
    ambiguousExpensesEur: mixedExpensesEur
  };
}
