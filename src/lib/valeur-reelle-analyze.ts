import { bankinSubcategoryLabel } from "@/lib/bankin/categorize";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  countsTowardDashboardExpenseTotal,
  filterDashboardTransactions,
  isPersonalInternalTransferMovement,
  last12MonthsKeys,
  type DashboardAnalyticsFilter
} from "@/lib/dashboard-metrics";
import {
  formatDashboardPeriodLabelWithMonth,
  formatDashboardPeriodLabelWithMonths
} from "@/lib/dashboard-period";
import { deriveExpenseBucket, type DerivedExpenseBucket } from "@/lib/derived-expense-bucket";
import {
  amountNetOfRecoverableVat,
  recoverableVatRule,
  vatIncludedInGross
} from "@/lib/recoverable-expense-vat";

export { amountNetOfRecoverableVat } from "@/lib/recoverable-expense-vat";
import { categorizeHiwayExpense, HIWAY_EXPENSE_CATEGORIES, type HiwayExpenseCategory } from "@/lib/hiway-categorisation";
import { allocateIncomeTaxToPeriod } from "@/lib/impots/tax-analysis";
import { matchesLoyersRecusSubcategory } from "@/lib/lmnp-analyze";
import { isRevenueCategory } from "@/lib/revenue-category";
import {
  formatHiddenValueSublabel,
  formatRealExpenseSublabel,
  blobMatchesMixedExpense,
  hiddenValueRecoveryRatio,
  isDsnPasImpôtBlob,
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

/** Taux d’impôt métier appliqué au BNC restant après charges DigitPro. */
export const DEFAULT_IR_ON_BNC_RATE = 0.17;
export const CSG_ON_BNC_RATE = 0.097;

/** Recalcule la CSG pour un CA HT donné en conservant les réintégrations sociales du mois de référence. */
export function computeCsgEurForCaFacture(
  caFactureEur: number,
  mandatoryFeesEur: number,
  personalChargesEur: number,
  reference: Pick<ValeurReelleCashTree, "caFactureEur" | "csgEur">
): number {
  const refOperating = reference.caFactureEur - mandatoryFeesEur - personalChargesEur;
  const refCsgCore = reference.csgEur > 0 ? reference.csgEur : 0;
  const refBase = refCsgCore > 0 ? refCsgCore / CSG_ON_BNC_RATE : 0;
  const reintegrations = Math.max(0, refBase - Math.max(0, refOperating));

  const operating = caFactureEur - mandatoryFeesEur - personalChargesEur;
  const base = Math.max(0, operating + reintegrations);
  return Math.round(base * CSG_ON_BNC_RATE * 100) / 100;
}

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

function outgoingTransferLabelIsBnc(tx: DashboardTx): boolean {
  return tx.amount < 0 && /\bbnc\b/.test(fold(tx.label));
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
  grossAmountEur?: number;
  count: number;
  transactions?: Array<{
    id: string;
    date: string;
    label: string;
    category: string;
    company: string;
    amountEur: number;
    grossAmountEur?: number;
  }>;
};

export type ValeurReelleVatMonthlyRow = {
  monthKey: string;
  grossEur: number;
  vatEur: number;
  count: number;
  breakdown: ValeurReelleWaterfallBreakdownRow[];
};

export type ValeurReelleVatLiability = {
  collectedVatEur: number;
  paidVatEur: number;
  recoverableVatEur: number;
  recoverableVat20Eur: number;
  recoverableVat10Eur: number;
  remainingVatEur: number;
  paidTransactions: BreakdownTransaction[];
};

export type ValeurReelleVatSavingsKpis = {
  referenceMonthKey: string;
  referenceYear: number;
  monthsElapsed: number;
  monthEur: number;
  ytdEur: number;
  annualProjectionEur: number;
  averageMonthlyEur: number;
};

export type ValeurReelleWaterfallStep = {
  id: string;
  label: string;
  deltaEur: number;
  cumulativeEur: number;
  tone: "emerald" | "rose" | "green" | "amber" | "sky";
  breakdown: ValeurReelleWaterfallBreakdownRow[];
};

type BreakdownTransaction = NonNullable<ValeurReelleWaterfallBreakdownRow["transactions"]>[number];
type BreakdownAccumulatorValue = {
  amountEur: number;
  grossAmountEur?: number;
  count: number;
  transactions?: BreakdownTransaction[];
};
type WaterfallBreakdownAccumulator = Map<string, BreakdownAccumulatorValue>;

function waterfallBreakdownMap(): Map<string, WaterfallBreakdownAccumulator> {
  return new Map();
}

function addWaterfallBreakdown(
  root: Map<string, WaterfallBreakdownAccumulator>,
  stepId: string,
  label: string,
  amountEur: number,
  transaction?: BreakdownTransaction
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
    prev.grossAmountEur = (prev.grossAmountEur ?? 0) + (transaction?.grossAmountEur ?? amountEur);
    prev.count += 1;
    if (transaction) prev.transactions = [...(prev.transactions ?? []), transaction];
  } else {
    step.set(label, { amountEur, grossAmountEur: transaction?.grossAmountEur ?? amountEur, count: 1, transactions: transaction ? [transaction] : undefined });
  }
}

function materializeWaterfallBreakdown(
  root: Map<string, WaterfallBreakdownAccumulator>,
  stepId: string
): ValeurReelleWaterfallBreakdownRow[] {
  const step = root.get(stepId);
  if (!step) return [];
  return Array.from(step.entries())
    .map(([label, v]) => ({ label, amountEur: v.amountEur, grossAmountEur: v.grossAmountEur, count: v.count, transactions: v.transactions }))
    .sort((a, b) => Math.abs(b.amountEur) - Math.abs(a.amountEur));
}

export type ValeurReelleCashTree = {
  caTtcEur: number;
  caFactureEur: number;
  mandatoryFeesEur: number;
  mandatoryFeesBreakdown: ValeurReelleWaterfallBreakdownRow[];
  mandatoryFeeTransactions: Array<{
    date: string;
    label: string;
    group: string;
    amountEur: number;
  }>;
  csgEur: number;
  personalChargesEur: number;
  personalChargesBreakdown: ValeurReelleWaterfallBreakdownRow[];
  bncEur: number;
  realEarningsEur: number;
  digitProChargesEur: number;
  chargesEtCsgEur: number;
  recoverableChargesGrossEur: number;
  /** Valeur récupérée sur des charges « avantages » (IK, repas, CESU…). */
  chargesUtilesRecupereesEur: number;
  bncBrutEur: number;
  bncRestantApresChargesEur: number;
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
  month: string | null = null,
  now = new Date()
): number {
  if (month) {
    return billableIsos.filter((iso) => iso.slice(0, 7) === month).length;
  }
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
  vatRecoverableMonthlyRows: ValeurReelleVatMonthlyRow[];
  vatLiability: ValeurReelleVatLiability;
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

function addBreakdownRow(
  rows: Map<string, BreakdownAccumulatorValue>,
  label: string,
  amountEur: number,
  transaction?: BreakdownTransaction
) {
  if (!amountEur) return;
  const prev = rows.get(label);
  if (prev) {
    prev.amountEur += amountEur;
    prev.grossAmountEur = (prev.grossAmountEur ?? 0) + (transaction?.grossAmountEur ?? amountEur);
    prev.count += 1;
    if (transaction) prev.transactions = [...(prev.transactions ?? []), transaction];
  } else {
    rows.set(label, { amountEur, grossAmountEur: transaction?.grossAmountEur ?? amountEur, count: 1, transactions: transaction ? [transaction] : undefined });
  }
}

function materializeRows(rows: Map<string, BreakdownAccumulatorValue>): ValeurReelleWaterfallBreakdownRow[] {
  return Array.from(rows.entries())
    .map(([label, v]) => ({ label, amountEur: v.amountEur, grossAmountEur: v.grossAmountEur, count: v.count, transactions: v.transactions }))
    .sort((a, b) => Math.abs(b.amountEur) - Math.abs(a.amountEur));
}

export type SasuSimplifiedExpenseGroup = "Frais DigitPro" | "Frais perso";

export function isDsnPasImpôtLine(tx: DashboardTx): boolean {
  return isDsnPasImpôtBlob(txBlob(tx));
}

export function isSasuRetraiteExpenseLine(tx: DashboardTx, bucket: DerivedExpenseBucket | null): boolean {
  if (!bucket || isDsnPasImpôtLine(tx)) return false;
  return isRetraiteExpense(bucket, txBlob(tx), fold(bankinSubcategoryLabel(tx.category)), tx.category);
}

/**
 * Partition exclusive alignée sur la vue Catégories : perso d'abord, tout le reste KPI → DigitPro.
 */
export function resolveSasuSimplifiedExpenseGroup(
  tx: DashboardTx,
  bucket: DerivedExpenseBucket | null
): SasuSimplifiedExpenseGroup | null {
  if (tx.amount >= 0 || !bucket) return null;
  if (isValeurReellePersonalChargeLine(bucket)) return "Frais perso";
  return "Frais DigitPro";
}

/** Libellé sous-catégorie simplifié = même bucket que la vue Catégories. */
export function sasuSimplifiedSubcategoryLabel(tx: DashboardTx, bucket: DerivedExpenseBucket): string {
  if (isDsnPasImpôtLine(tx) || bucket === "Impôt") return "Impôt";
  if (isSasuRetraiteExpenseLine(tx, bucket)) return "Retraite";
  return bucket;
}

export function isValeurReelleMandatoryFeeLine(tx: DashboardTx, bucket: DerivedExpenseBucket | null): boolean {
  if (bucket === "TVA") return false;
  if (isDsnPasImpôtLine(tx)) return true;
  if (isSasuRetraiteExpenseLine(tx, bucket)) return true;
  if (tx.categoryManual) {
    return (
      bucket === "Compta & admin." ||
      bucket === "Impôt" ||
      bucket === "Urssaf" ||
      bucket === "Retraite" ||
      bucket === "Mobile et Internet" ||
      bucket === "Qonto" ||
      bucket === "Assurance" ||
      bucket === "Matériel" ||
      bucket === "Autres"
    );
  }
  const b = txBlob(tx);
  return (
    b.includes("hiway") ||
    b.includes("urssaf") ||
    b.includes("dgfip") ||
    b.includes("impot") ||
    b.includes("impôt") ||
    /\bpas\b/.test(b) ||
    /\bsfr\b/.test(b) ||
    /\bfree\b/.test(b) ||
    bucket === "Compta & admin." ||
    bucket === "Impôt" ||
    bucket === "Urssaf" ||
    bucket === "Retraite" ||
    bucket === "Mobile et Internet" ||
    bucket === "Qonto" ||
    bucket === "Assurance" ||
    bucket === "Matériel" ||
    bucket === "Autres"
  );
}

export const VALEUR_REELLE_EXPENSE_CATEGORIES = HIWAY_EXPENSE_CATEGORIES;

export type ValeurReelleExpenseCategory = HiwayExpenseCategory;

function breakdownTransaction(tx: DashboardTx, amountEur: number, grossAmountEur?: number): BreakdownTransaction {
  return {
    id: tx.id,
    date: tx.date,
    label: tx.label,
    category: tx.category,
    company: tx.company,
    amountEur,
    grossAmountEur
  };
}

export function valeurReelleExpenseCategoryLabel(
  tx: DashboardTx,
  bucket: DerivedExpenseBucket | null
): ValeurReelleExpenseCategory {
  if (isDsnPasImpôtLine(tx) || bucket === "Impôt") return "Impôt";
  if (bucket && isRetraiteExpense(bucket, txBlob(tx), fold(bankinSubcategoryLabel(tx.category)), tx.category)) {
    return "Retraite";
  }
  if (bucket === "TVA") return "Paiement TVA";
  if (bucket === "Retraite") return "Retraite";
  if (bucket === "Urssaf") return "Urssaf";
  if (bucket === "Qonto") return "Frais bancaires";
  return categorizeHiwayExpense({ ...tx, category: tx.category || bucket || "" });
}

export function isValeurReellePersonalChargeLine(bucket: DerivedExpenseBucket | null): boolean {
  return (
    bucket === "NDF" ||
    bucket === "Indemnités kilométriques" ||
    bucket === "CESU" ||
    bucket === "ANCV" ||
    bucket === "Repas d'affaire" ||
    bucket === "Cadeau client" ||
    bucket === "Repas dirigeant" ||
    bucket === "Mutuelle" ||
    bucket === "iCloud IA Store"
  );
}

/** Les frais de repas sont présentés HT dans la section « Valeur » (TVA 10 %). */
function valeurReelleExpenseAmount(tx: DashboardTx, bucket: DerivedExpenseBucket | null, grossEur: number): number {
  if (bucket === "Repas d'affaire" || bucket === "Repas dirigeant") {
    return amountNetOfRecoverableVat(tx, bucket, grossEur);
  }
  return grossEur;
}

function isCsgSocialReintegrationLine(bucket: DerivedExpenseBucket | null): boolean {
  return bucket === "Urssaf";
}

function materializeVatMonthlyRows(
  rows: Map<string, { grossEur: number; vatEur: number; count: number; breakdown: Map<string, { amountEur: number; count: number }> }>
): ValeurReelleVatMonthlyRow[] {
  return Array.from(rows.entries())
    .map(([monthKey, v]) => ({
      monthKey,
      grossEur: Math.round(v.grossEur * 100) / 100,
      vatEur: Math.round(v.vatEur * 100) / 100,
      count: v.count,
      breakdown: materializeRows(v.breakdown)
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

function roundVatEur(amountEur: number): number {
  return Math.round(amountEur * 100) / 100;
}

/**
 * KPIs Économies TVA : mois de référence, cumul depuis janvier et projection annuelle.
 * La projection annualise la moyenne mensuelle YTD : (YTD / mois écoulés) × 12.
 */
export function computeVatSavingsKpis(
  monthlyRows: readonly ValeurReelleVatMonthlyRow[],
  options?: { referenceMonthKey?: string | null; now?: Date }
): ValeurReelleVatSavingsKpis {
  const now = options?.now ?? new Date();
  const referenceMonthKey =
    options?.referenceMonthKey ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const referenceYear = Number(referenceMonthKey.slice(0, 4));
  const monthsElapsed = Number(referenceMonthKey.slice(5, 7));

  const yearRows = monthlyRows.filter((row) => row.monthKey.startsWith(`${referenceYear}-`));

  const monthEur = roundVatEur(
    yearRows.find((row) => row.monthKey === referenceMonthKey)?.vatEur ?? 0
  );

  const ytdEur = roundVatEur(
    yearRows
      .filter((row) => row.monthKey <= referenceMonthKey)
      .reduce((sum, row) => sum + row.vatEur, 0)
  );

  const averageMonthlyEur = monthsElapsed > 0 ? roundVatEur(ytdEur / monthsElapsed) : 0;
  const annualProjectionEur = roundVatEur(averageMonthlyEur * 12);

  return {
    referenceMonthKey,
    referenceYear,
    monthsElapsed,
    monthEur,
    ytdEur,
    annualProjectionEur,
    averageMonthlyEur
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
  const month = options?.month ?? null;
  const months = options?.months ?? null;
  const periodLabel =
    months != null && months.length > 0
      ? formatDashboardPeriodLabelWithMonths(years, months)
      : formatDashboardPeriodLabelWithMonth(years, month);
  const scoped = filterDashboardTransactions([...transactions], { years, month, months }, now);

  let activeIncomeEur = 0;
  let passiveIncomeEur = 0;
  let realExpensesEur = 0;
  let hiddenExpensesGrossEur = 0;
  let hiddenValueRecoveredEur = 0;
  let mixedExpensesEur = 0;
  let mixedValueRecoveredEur = 0;
  let taxesEur = 0;
  let impotPayeEur = 0;
  let digitProChargesEur = 0;
  let ndfIkGrossEur = 0;
  let ndfIkRecoveredEur = 0;
  let mandatoryFeesEur = 0;
  let csgSocialReintegrationsEur = 0;
  let personalChargesEur = 0;
  let bncPaidEur = 0;
  let paidVatEur = 0;
  let recoverableVat20Eur = 0;
  let recoverableVat10Eur = 0;
  const paidVatTransactions: BreakdownTransaction[] = [];

  const movements: ClassifiedValeurReelleMovement[] = [];
  const categoryMap = new Map<string, ValeurReelleCategoryRow>();
  const waterfallBreakdown = waterfallBreakdownMap();
  const mandatoryFeesBreakdown = new Map<string, BreakdownAccumulatorValue>();
  const personalChargesBreakdown = new Map<string, BreakdownAccumulatorValue>();
  const vatRecoverableMonthly = new Map<string, { grossEur: number; vatEur: number; count: number; breakdown: Map<string, { amountEur: number; count: number; transactions?: BreakdownTransaction[] }> }>();
  const mandatoryFeeTransactions: ValeurReelleCashTree["mandatoryFeeTransactions"] = [];

  for (const tx of scoped) {
    const classified = classifyValeurReelleTransaction(tx);
    const group = classified.group;
    const kind = classified.kind;
    const amtAbs = Math.abs(tx.amount);
    const bucket = classified.bucket;
    const valeurExpenseEur = valeurReelleExpenseAmount(tx, bucket, amtAbs);

    if (isProScope(tx) && outgoingTransferLabelIsBnc(tx)) {
      bncPaidEur += amtAbs;
    }
    if (isProScope(tx) && tx.amount < 0 && bucket === "TVA") {
      paidVatEur += amtAbs;
      paidVatTransactions.push(breakdownTransaction(tx, amtAbs));
    }
    if (
      isProScope(tx) &&
      tx.amount < 0 &&
      bucket !== "BNC" &&
      (isValeurReelleMandatoryFeeLine(tx, bucket) || isSasuRetraiteExpenseLine(tx, bucket))
    ) {
      const feeLabel = valeurReelleExpenseCategoryLabel(tx, bucket);
      const feeAmountEur = amountNetOfRecoverableVat(tx, bucket, amtAbs);
      mandatoryFeesEur += feeAmountEur;
      if (isCsgSocialReintegrationLine(bucket)) {
        csgSocialReintegrationsEur += feeAmountEur;
      }
      addBreakdownRow(mandatoryFeesBreakdown, feeLabel, feeAmountEur, breakdownTransaction(tx, feeAmountEur, amtAbs));
      mandatoryFeeTransactions.push({
        date: tx.date,
        label: tx.label,
        group: feeLabel,
        amountEur: feeAmountEur
      });
    }
    if (isProScope(tx) && tx.amount < 0) {
      const vatRule = recoverableVatRule(tx, bucket);
      if (vatRule) {
        const monthKey = tx.date.slice(0, 7);
        const vatEur = vatIncludedInGross(amtAbs, vatRule.rate);
        const row =
          vatRecoverableMonthly.get(monthKey) ??
          { grossEur: 0, vatEur: 0, count: 0, breakdown: new Map<string, { amountEur: number; count: number; transactions?: BreakdownTransaction[] }>() };
        row.grossEur += amtAbs;
        row.vatEur += vatEur;
        row.count += 1;
        if (Math.round(vatRule.rate * 100) === 10) {
          recoverableVat10Eur += vatEur;
        } else {
          recoverableVat20Eur += vatEur;
        }
        addBreakdownRow(row.breakdown, `${vatRule.label} · ${Math.round(vatRule.rate * 100)} %`, vatEur);
        vatRecoverableMonthly.set(monthKey, row);
      }
    }

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
      if (countsTowardDashboardExpenseTotal(tx)) {
        digitProChargesEur += amtAbs;
      }
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
      if (isValeurReellePersonalChargeLine(bucket)) {
        personalChargesEur += valeurExpenseEur;
        addBreakdownRow(personalChargesBreakdown, valeurReelleExpenseCategoryLabel(tx, bucket), valeurExpenseEur, breakdownTransaction(tx, valeurExpenseEur, amtAbs));
      }
      if (
        classified.bucket === "NDF" ||
        classified.bucket === "Indemnités kilométriques" ||
        classified.sublabel.toLowerCase().includes("kilométr")
      ) {
        ndfIkGrossEur += amtAbs;
        ndfIkRecoveredEur += hiddenValueEur;
      }
      if (hiddenValueEur > 0) {
        addWaterfallBreakdown(waterfallBreakdown, "recupere", classified.sublabel, hiddenValueEur);
      }
    } else if (group === "mixed") {
      if (!isProScope(tx)) continue;
      mixedExpensesEur += amtAbs;
      mixedValueRecoveredEur += hiddenValueEur;
      if (isValeurReellePersonalChargeLine(bucket)) {
        personalChargesEur += valeurExpenseEur;
        addBreakdownRow(personalChargesBreakdown, valeurReelleExpenseCategoryLabel(tx, bucket), valeurExpenseEur, breakdownTransaction(tx, valeurExpenseEur, amtAbs));
      }
      if (classified.bucket === "NDF" || classified.sublabel.toLowerCase().includes("note de frais")) {
        ndfIkGrossEur += amtAbs;
        ndfIkRecoveredEur += hiddenValueEur;
      }
    }

    const catKey = `${group}:${classified.sublabel}`;
    const categoryAmountEur = group === "active_income" || group === "passive_income" ? tx.amount : valeurExpenseEur;
    const prev = categoryMap.get(catKey);
    if (prev) {
      prev.totalEur += categoryAmountEur;
      prev.count += 1;
      prev.hiddenValueEur += hiddenValueEur;
    } else {
      categoryMap.set(catKey, {
        key: catKey,
        label: classified.sublabel,
        group,
        kind,
        totalEur: categoryAmountEur,
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
  const caTtcEur = activeIncomeEur;
  const caFactureEur = Math.round((caTtcEur / 1.2) * 100) / 100;
  const collectedVatEur = Math.max(0, Math.round((caTtcEur - caFactureEur) * 100) / 100);
  const recoverableVatEur = Math.round((recoverableVat20Eur + recoverableVat10Eur) * 100) / 100;
  const remainingVatEur = Math.round((collectedVatEur - paidVatEur - recoverableVatEur) * 100) / 100;
  const realEarningsEur = caFactureEur - mandatoryFeesEur + personalChargesEur;
  const chargesEtCsgEur = digitProChargesEur;
  const bncBrutEur = Math.max(0, caFactureEur - digitProChargesEur);
  const bncEur = bncPaidEur;
  const csgOperatingExpensesEur = mandatoryFeesEur + personalChargesEur;
  const csgOperatingResultEur = caFactureEur - csgOperatingExpensesEur;
  const csgBaseEur = Math.max(0, csgOperatingResultEur + csgSocialReintegrationsEur);
  const csgEur = Math.round(csgBaseEur * CSG_ON_BNC_RATE * 100) / 100;
  const bncRestantApresChargesEur = bncBrutEur;
  const periodIncomeTax = allocateIncomeTaxToPeriod({ years, month, months, now }, bncBrutEur);
  const impotEstimeEur = periodIncomeTax.amountEur;
  const impotEstime = periodIncomeTax.estimated;
  const impotUtiliseEur = periodIncomeTax.amountEur;
  const netCashEur = caFactureEur - digitProChargesEur - impotUtiliseEur;
  const revenusIndirectsEur = ndfIkRecoveredEur;
  const netReelEur = netCashEur + revenusIndirectsEur;

  const cashTree: ValeurReelleCashTree = {
    caTtcEur,
    caFactureEur,
    mandatoryFeesEur,
    mandatoryFeesBreakdown: materializeRows(mandatoryFeesBreakdown),
    mandatoryFeeTransactions: mandatoryFeeTransactions.sort(
      (a, b) => b.date.localeCompare(a.date) || Math.abs(b.amountEur) - Math.abs(a.amountEur)
    ),
    csgEur,
    personalChargesEur,
    personalChargesBreakdown: materializeRows(personalChargesBreakdown),
    bncEur,
    realEarningsEur,
    digitProChargesEur,
    chargesEtCsgEur,
    recoverableChargesGrossEur: ndfIkGrossEur,
    chargesUtilesRecupereesEur: ndfIkRecoveredEur,
    bncBrutEur,
    bncRestantApresChargesEur,
    impotPayeEur: periodIncomeTax.estimated ? 0 : periodIncomeTax.amountEur,
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
    vatRecoverableMonthlyRows: materializeVatMonthlyRows(vatRecoverableMonthly),
    vatLiability: {
      collectedVatEur,
      paidVatEur: Math.round(paidVatEur * 100) / 100,
      recoverableVatEur,
      recoverableVat20Eur: Math.round(recoverableVat20Eur * 100) / 100,
      recoverableVat10Eur: Math.round(recoverableVat10Eur * 100) / 100,
      remainingVatEur,
      paidTransactions: paidVatTransactions.sort(
        (a, b) => b.date.localeCompare(a.date) || Math.abs(b.amountEur) - Math.abs(a.amountEur)
      )
    }
  };
}
