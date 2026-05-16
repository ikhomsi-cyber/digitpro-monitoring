"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
  CarFront,
  Utensils
} from "lucide-react";
import { clsx } from "clsx";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import {
  computeCalendarStickyKpis,
  computeTjmWorkdayGauge,
  isBillableWorkdayIso,
  monthTitleFr,
  toBillableIso,
  workedDaysChartPeriodLabel
} from "@/lib/billable-calendar-metrics";
import { indemniteKmPerWorkDayEur } from "@/lib/pluxee-commute-indemnity";
import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
import { getParisZoneCSchoolVacationLabel } from "@/lib/fr-school-holidays-paris";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { TreasuryVerserPanel } from "@/components/dashboard/TreasuryVerserPanel";
import { BillableInvoiceWorkedDaysChart } from "@/components/dashboard/BillableInvoiceWorkedDaysChart";
import {
  appendAgendaWorkedDayMonths,
  buildInvoiceWorkedDaysPastMonthsSeries
} from "@/lib/invoice-worked-days-series";

/** En-têtes courts (2 lettres), calendrier compact. */
const WEEKDAYS_SHORT = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"] as const;

function monthMatrix(year: number, month0: number): ({ day: number } | null)[] {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  return cells;
}

const IK_REFERENCE_EUR = 550;
const MEALS_REFERENCE_EUR = 650;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Jauge : jours ouvrés cochés vs reste jusqu’à fin de mois (TJM / même logique que le bloc). */
function WorkdaysMonthGauge({
  isCurrent,
  countedBillable,
  remainingBillable,
  totalBillableMonth
}: {
  isCurrent: boolean;
  countedBillable: number;
  remainingBillable: number;
  totalBillableMonth: number;
}) {
  const fmt = useDashboardDisplayFormat();
  let pct = 0;
  let denomLabel: string;
  if (isCurrent) {
    const d = countedBillable + remainingBillable;
    if (d > 0) {
      pct = clamp01(countedBillable / d);
      denomLabel = `${fmt.int(countedBillable)} cochés / ${fmt.int(remainingBillable)} rest.`;
    } else if (totalBillableMonth > 0) {
      pct = clamp01(countedBillable / totalBillableMonth);
      denomLabel = `${fmt.int(countedBillable)} / ${fmt.int(totalBillableMonth)} j. ouvrés`;
    } else {
      denomLabel = "0 j.";
    }
  } else if (totalBillableMonth > 0) {
    pct = clamp01(countedBillable / totalBillableMonth);
    denomLabel = `${fmt.int(countedBillable)} / ${fmt.int(totalBillableMonth)} j. ouvrés`;
  } else {
    denomLabel = "0 j.";
  }
  const pctLabel = fmt.percent0to100(pct * 100);

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink-500 dark:text-ink-400">
        <span className="font-medium text-ink-600 dark:text-ink-300">Jauge j. ouvrés cochés / reste</span>
        <span className="tabular-nums text-[10px]">
          {denomLabel} · {pctLabel}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-black/[0.04] dark:bg-ink-800 dark:ring-white/10">
        <div className="h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function BudgetGauge({
  valueEur,
  referenceEur,
  tone = "emerald",
  label
}: {
  valueEur: number;
  referenceEur: number;
  tone?: "emerald" | "analyze" | "rose";
  label: string;
}) {
  const fmt = useDashboardDisplayFormat();
  const pct = clamp01(referenceEur > 0 ? valueEur / referenceEur : 0);
  const pctLabel = fmt.percent0to100(pct * 100);

  const fillClass =
    tone === "analyze"
      ? "bg-analyze-600 dark:bg-analyze-500"
      : tone === "rose"
        ? "bg-rose-600 dark:bg-rose-500"
        : "bg-emerald-600 dark:bg-emerald-500";

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink-500 dark:text-ink-400">
        <span className="font-medium text-ink-600 dark:text-ink-300">{label}</span>
        <span className="tabular-nums">
          {fmt.euro(valueEur)} / {fmt.euro(referenceEur)} · {pctLabel}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-black/[0.04] dark:bg-ink-800 dark:ring-white/10">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function foldTxBlob(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dépenses privées « NDF DigitPro » (Bankin : sous-cat. DigitPro consulting NDF → catégorie stockée
 * `NDF DigitPro`, ou anciennes lignes `Notes de frais` + mention DigitPro dans libellé / société).
 */
function isPersonalNdfDigitProInMonth(tx: DashboardTx, monthKey: string): boolean {
  if ((tx.scope ?? "pro") !== "personal" || tx.amount >= 0) return false;
  if (tx.date.slice(0, 7) !== monthKey) return false;
  if (tx.category === "NDF DigitPro") return true;
  const blob = foldTxBlob(`${tx.label} ${tx.company} ${tx.category}`);
  if (!blob.includes("digitpro")) return false;
  return deriveExpenseBucket(tx) === "NDF";
}

export function BillableDaysCalendarBlock({
  treasuryTransactions,
  treasuryScope
}: {
  /** Mouvements pour le bloc trésorerie (solde, CA, TVA). */
  treasuryTransactions?: DashboardTx[];
  treasuryScope?: "pro" | "personal";
}) {
  const { selected, setSelected, hydrated, tjmHt, persistToSupabase } = useBillableActivity();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth0, setViewMonth0] = useState(now.getMonth());
  const fmt = useDashboardDisplayFormat();
  const matrix = useMemo(() => monthMatrix(viewYear, viewMonth0), [viewYear, viewMonth0]);

  const publicHolidays = useMemo(() => getFrenchPublicHolidaysForYear(viewYear), [viewYear]);

  const countInMonth = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
    let n = 0;
    for (const d of selected) {
      if (d.startsWith(prefix)) n++;
    }
    return n;
  }, [selected, viewYear, viewMonth0]);

  const countInYear = useMemo(() => {
    const prefix = `${viewYear}-`;
    let n = 0;
    for (const d of selected) {
      if (d.startsWith(prefix)) n++;
    }
    return n;
  }, [selected, viewYear]);

  const revenueMonthHt = countInMonth * tjmHt;
  const revenueYearHt = countInYear * tjmHt;

  /**
   * Mois affiché dans le calendrier (viewYear / viewMonth0) : jours pris en compte pour brut + IK.
   * - Mois passé : tous les jours cochés du mois.
   * - Mois en cours : jours cochés avec date ≤ aujourd’hui.
   * - Mois futur : tous les jours cochés sur la grille (planification).
   */
  const selectedViewMonthStats = useMemo(() => {
    const d = new Date();
    const nowY = d.getFullYear();
    const nowM0 = d.getMonth();
    const todayIso = toBillableIso(nowY, nowM0, d.getDate());
    const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
    const monthTitle = monthTitleFr(viewYear, viewMonth0);

    const isPast =
      viewYear < nowY || (viewYear === nowY && viewMonth0 < nowM0);
    const isCurrent = viewYear === nowY && viewMonth0 === nowM0;

    let countedDays = 0;
    for (const iso of selected) {
      if (!iso.startsWith(prefix)) continue;
      if (isPast) {
        countedDays++;
      } else if (isCurrent) {
        if (iso <= todayIso) countedDays++;
      } else {
        countedDays++;
      }
    }

    const todayLongFr = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(d);

    return { countedDays, monthTitle, isPast, isCurrent, todayLongFr };
  }, [selected, viewYear, viewMonth0]);

  const tjmWorkdayGauge = useMemo(
    () => computeTjmWorkdayGauge(selected, viewYear, viewMonth0),
    [selected, viewYear, viewMonth0]
  );

  const brutTjmMoisEncoursHt = selectedViewMonthStats.countedDays * tjmHt;
  const ikPerDay = indemniteKmPerWorkDayEur();
  const ikMoisEncours = selectedViewMonthStats.countedDays * ikPerDay;

  const mealFeesForViewedMonth = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return null;
    const monthKey = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}`;
    const nextMonthStart = new Date(viewYear, viewMonth0, 1);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
    const nextMonthKey = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, "0")}`;

    const cal = new Date();
    const isViewedCalendarMonthCurrent =
      viewYear === cal.getFullYear() && viewMonth0 === cal.getMonth();

    let dirigeant = 0;
    let ndfMoisSuivant = 0;
    for (const tx of treasuryTransactions) {
      if ((tx.scope ?? "pro") !== treasuryScope) continue;
      if (tx.amount >= 0) continue;
      const d = tx.date.slice(0, 7);
      const bucket = deriveExpenseBucket(tx);
      const amt = Math.abs(tx.amount);
      if (d === monthKey && bucket === "Repas dirigeant") dirigeant += amt;
      if (d === nextMonthKey && bucket === "NDF") ndfMoisSuivant += amt;
    }

    /** Notes DigitPro avancées sur compte perso (même mois civil que le calendrier), uniquement mois en cours. */
    let ndfPersoDigitProMoisCourant = 0;
    if (isViewedCalendarMonthCurrent) {
      for (const tx of treasuryTransactions) {
        if (!isPersonalNdfDigitProInMonth(tx, monthKey)) continue;
        ndfPersoDigitProMoisCourant += Math.abs(tx.amount);
      }
    }

    const ndfAffiche = ndfMoisSuivant + ndfPersoDigitProMoisCourant;
    const repasTotal = dirigeant;
    return {
      dirigeant,
      repasTotal,
      ndfMoisSuivant,
      ndfPersoDigitProMoisCourant,
      ndfAffiche,
      /** Repas dirigeant du mois affiché + NDF (mois suivant côté périmètre trésorerie + NDF DigitPro privé du mois en cours). */
      total: repasTotal + ndfAffiche
    };
  }, [treasuryTransactions, treasuryScope, viewYear, viewMonth0]);

  const calendarStickyKpis = useMemo(
    () => computeCalendarStickyKpis(selected, tjmHt, viewYear, viewMonth0),
    [selected, tjmHt, viewYear, viewMonth0]
  );

  const toggleDay = useCallback((iso: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }, []);

  const clearMonth = useCallback(() => {
    const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of prev) {
        if (d.startsWith(prefix)) next.delete(d);
      }
      return next;
    });
  }, [viewYear, viewMonth0]);

  const goPrevMonth = () => {
    if (viewMonth0 === 0) {
      setViewMonth0(11);
      setViewYear((y) => y - 1);
    } else setViewMonth0((m) => m - 1);
  };

  const goNextMonth = () => {
    if (viewMonth0 === 11) {
      setViewMonth0(0);
      setViewYear((y) => y + 1);
    } else setViewMonth0((m) => m + 1);
  };

  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth0(t.getMonth());
  };

  const clock = new Date();
  const todayIsoLive = toBillableIso(clock.getFullYear(), clock.getMonth(), clock.getDate());

  const invoiceWorkedDaysSeries = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return [];
    return buildInvoiceWorkedDaysPastMonthsSeries(treasuryTransactions, treasuryScope);
  }, [treasuryTransactions, treasuryScope]);

  const [workedDaysChartYear, setWorkedDaysChartYear] = useState<number | "all">(now.getFullYear());
  const [workedDaysChartQuarter, setWorkedDaysChartQuarter] = useState<"full" | 1 | 2 | 3 | 4>("full");

  useEffect(() => {
    if (workedDaysChartYear === "all") setWorkedDaysChartQuarter("full");
  }, [workedDaysChartYear]);

  const workedDaysChartAvailableYears = useMemo(() => {
    const ys = new Set<number>();
    for (const row of invoiceWorkedDaysSeries) ys.add(Number(row.monthKey.slice(0, 4)));
    ys.add(now.getFullYear());
    const lastY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    ys.add(lastY);
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoiceWorkedDaysSeries, now]);

  const filteredInvoiceWorkedDaysSeries = useMemo(() => {
    let rows = invoiceWorkedDaysSeries;
    if (workedDaysChartYear === "all") return rows;
    rows = rows.filter((r) => r.monthKey.startsWith(`${workedDaysChartYear}-`));
    if (workedDaysChartQuarter !== "full") {
      const q = workedDaysChartQuarter;
      const mStart = (q - 1) * 3 + 1;
      const mEnd = mStart + 2;
      rows = rows.filter((r) => {
        const m = Number(r.monthKey.slice(5, 7));
        return m >= mStart && m <= mEnd;
      });
    }
    return rows;
  }, [invoiceWorkedDaysSeries, workedDaysChartYear, workedDaysChartQuarter]);

  const chartWorkedDaysData = useMemo(() => {
    const withAgenda = appendAgendaWorkedDayMonths(filteredInvoiceWorkedDaysSeries, selected, tjmHt);
    if (workedDaysChartYear === "all") return withAgenda;
    let rows = withAgenda.filter((r) => r.monthKey.startsWith(`${workedDaysChartYear}-`));
    if (workedDaysChartQuarter !== "full") {
      const q = workedDaysChartQuarter;
      const mStart = (q - 1) * 3 + 1;
      const mEnd = mStart + 2;
      rows = rows.filter((r) => {
        const m = Number(r.monthKey.slice(5, 7));
        return m >= mStart && m <= mEnd;
      });
    }
    return rows;
  }, [
    filteredInvoiceWorkedDaysSeries,
    selected,
    tjmHt,
    workedDaysChartYear,
    workedDaysChartQuarter
  ]);

  const invoiceWorkedDaysAvg = useMemo(() => {
    const encaisseOnly = chartWorkedDaysData.filter((r) => r.kind === "encaisse");
    const n = encaisseOnly.length;
    if (!n) return null;
    const sumDays = encaisseOnly.reduce((s, x) => s + x.days, 0);
    return Math.round((sumDays / n) * 10) / 10;
  }, [chartWorkedDaysData]);

  const encaisseMonthsInView = useMemo(
    () => chartWorkedDaysData.filter((r) => r.kind === "encaisse").length,
    [chartWorkedDaysData]
  );

  const totalWorkedDaysInPeriod = useMemo(() => {
    const total = chartWorkedDaysData.reduce((sum, row) => sum + row.days, 0);
    return Math.round(total * 10) / 10;
  }, [chartWorkedDaysData]);

  const workedDaysChartPeriodLabelText = useMemo(
    () => workedDaysChartPeriodLabel(workedDaysChartYear, workedDaysChartQuarter),
    [workedDaysChartYear, workedDaysChartQuarter]
  );

  return (
    <Card variant="solid" className="overflow-hidden">
      <CardHeader className="border-b border-ink-100/80 bg-gradient-to-b from-ink-50/80 to-white pb-4 dark:border-white/[0.06] dark:bg-gradient-to-b dark:from-[#0f1412] dark:via-[#0a0c0b] dark:to-[#060606]">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50/90 text-emerald-700 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:shadow-none"
            aria-hidden
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="!mt-0 text-base font-semibold tracking-tight text-ink-900 dark:text-[#f4f4f2]">
              Jours travaillés & TJM
            </CardTitle>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-white/50 sm:text-xs">
              Calendrier des jours facturés, TJM et indicateurs du mois.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="relative px-4 pb-28 pt-4 sm:px-6 md:pb-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-5">
          {/* Calendrier + mois en cours : côte à côte dès sm */}
          <div className="flex w-full flex-col flex-wrap items-stretch gap-4 sm:flex-row sm:items-start sm:gap-4 lg:shrink-0">
          {/* Calendrier compact */}
          <div className="flex shrink-0 flex-col items-center sm:items-start">
            <div
              className="w-full max-w-[260px] rounded-2xl border border-ink-200/70 bg-white/90 p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03] dark:border-white/[0.09] dark:bg-white/[0.035] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-white/[0.06] sm:p-3.5"
              role="group"
              aria-label={`Calendrier ${monthTitleFr(viewYear, viewMonth0)}`}
            >
              <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                </button>
                <div className="min-w-0 text-center">
                  <p className="truncate text-xs font-semibold capitalize leading-tight text-ink-900 dark:text-ink-100">
                    {monthTitleFr(viewYear, viewMonth0)}
                  </p>
                  <button
                    type="button"
                    onClick={goToday}
                    className="mt-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    Aujourd’hui
                  </button>
                </div>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5">
                {WEEKDAYS_SHORT.map((w) => (
                  <div
                    key={w}
                    className="flex h-5 items-end justify-center pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400 dark:text-white/40"
                  >
                    {w}
                  </div>
                ))}
                {matrix.map((cell, i) => {
                  if (!cell) {
                    return <div key={`e-${i}`} className="h-8 w-8" aria-hidden />;
                  }
                  const iso = toBillableIso(viewYear, viewMonth0, cell.day);
                  const on = selected.has(iso);
                  const isToday = iso === todayIsoLive;
                  const dow = new Date(viewYear, viewMonth0, cell.day).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const holidayLabel = publicHolidays.get(iso);
                  const isHoliday = holidayLabel != null;
                  const schoolVacLabel = getParisZoneCSchoolVacationLabel(iso);
                  const isSchoolVacation = schoolVacLabel != null;
                  const titleParts = [holidayLabel, schoolVacLabel].filter(Boolean);
                  const dayTitle = titleParts.length > 0 ? titleParts.join(" · ") : undefined;
                  const ariaExtra = [
                    holidayLabel ? holidayLabel : null,
                    schoolVacLabel ? schoolVacLabel : null
                  ]
                    .filter(Boolean)
                    .join(", ");

                  const billable = isBillableWorkdayIso(iso, publicHolidays);
                  const pastMissed = billable && !on && !isHoliday && !isSchoolVacation && iso < todayIsoLive;
                  const futurePlanned = billable && !on && !isHoliday && !isSchoolVacation && iso >= todayIsoLive;
                  const heat = billable ? Math.min(1, 0.15 + (on ? 0.55 : pastMissed ? 0.35 : futurePlanned ? 0.25 : 0.12)) : 0;

                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={on}
                      title={dayTitle}
                      aria-label={`${iso}${ariaExtra ? `, ${ariaExtra}` : ""}${
                        on ? ", sélectionné" : ""
                      }${isToday ? ", aujourd’hui" : ""}`}
                      onClick={() => toggleDay(iso)}
                      style={heat > 0 ? { boxShadow: `inset 0 0 0 999px rgba(16,185,129,${heat * 0.12})` } : undefined}
                      className={clsx(
                        "relative flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0a0a0a]",
                        on
                          ? clsx(
                              "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] dark:from-emerald-500 dark:to-emerald-700",
                              isToday &&
                                "ring-2 ring-brand-400 ring-offset-2 ring-offset-white/90 dark:ring-brand-300 dark:ring-offset-emerald-900/80",
                              isHoliday &&
                                "ring-2 ring-orange-300/90 ring-offset-0 ring-offset-transparent dark:ring-orange-400/70",
                              !isHoliday &&
                                isSchoolVacation &&
                                "ring-2 ring-orange-200/90 ring-offset-0 ring-offset-transparent dark:ring-orange-500/60"
                            )
                          : clsx(
                              "text-ink-800 hover:bg-ink-100/90 dark:text-ink-200 dark:hover:bg-white/5",
                              isHoliday &&
                                "bg-orange-50/95 font-semibold text-orange-950 ring-1 ring-orange-200/90 hover:bg-orange-100/95 dark:bg-orange-950/50 dark:text-orange-100 dark:ring-orange-800/60 dark:hover:bg-orange-900/55",
                              !isHoliday &&
                                isSchoolVacation &&
                                "bg-orange-50/90 font-medium text-orange-950 ring-1 ring-orange-200/80 hover:bg-orange-100/90 dark:bg-orange-950/45 dark:text-orange-50 dark:ring-orange-800/55 dark:hover:bg-orange-900/50",
                              pastMissed &&
                                "bg-rose-50 font-semibold text-rose-900 ring-1 ring-rose-200/90 dark:bg-rose-950/45 dark:text-rose-100 dark:ring-rose-800/60",
                              futurePlanned &&
                                "bg-sky-50 font-semibold text-sky-950 ring-1 ring-sky-200/90 dark:bg-sky-950/40 dark:text-sky-100 dark:ring-sky-600/50",
                              !isHoliday && !isSchoolVacation && isWeekend && !pastMissed && !futurePlanned && "text-ink-400 dark:text-ink-600",
                              isToday &&
                                "z-[1] ring-2 ring-brand-500 ring-offset-1 dark:ring-brand-400 dark:ring-offset-[#0a0a0a]",
                              isToday &&
                                !pastMissed &&
                                !futurePlanned &&
                                (isHoliday
                                  ? "bg-orange-50 font-bold text-orange-950 dark:bg-orange-950/60 dark:text-orange-100"
                                  : isSchoolVacation
                                    ? "bg-orange-50 font-bold text-orange-950 dark:bg-orange-950/55 dark:text-orange-50"
                                    : "bg-brand-50 font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300")
                            )
                      )}
                    >
                      {cell.day}
                      {isToday ? (
                        <span
                          className={clsx(
                            "pointer-events-none absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                            on
                              ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] ring-1 ring-white/50"
                              : "bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.7)] ring-1 ring-brand-400/60 dark:bg-brand-400 dark:shadow-[0_0_10px_rgba(96,165,250,0.55)] dark:ring-brand-300/50"
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={clearMonth}
              className="mt-2 max-w-[238px] text-center text-[10px] font-medium text-ink-500 transition hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200 sm:text-left"
            >
              Effacer ce mois
            </button>
            <div className="mt-1.5 max-w-[238px] space-y-1 text-center text-[9px] leading-snug text-ink-400 dark:text-ink-500 sm:text-left">
              <p className="inline-flex items-center gap-1">
                <span
                  className="relative inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(59,130,246,0.55)] ring-2 ring-brand-500/35 dark:bg-brand-400 dark:shadow-[0_0_8px_rgba(96,165,250,0.45)] dark:ring-brand-400/40"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-ink-500 dark:text-ink-400">Aujourd’hui</span> — bordure bleue +
                  point sous la date.
                </span>
              </p>
              <p className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-amber-100 ring-1 ring-amber-200/80 dark:bg-amber-900/60 dark:ring-amber-700/60"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-ink-500 dark:text-ink-400">Fériés</span> (métrop.) — survol pour le
                  nom.
                </span>
              </p>
              <p className="inline-flex items-start gap-1.5 text-left">
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-sm bg-sky-100 ring-1 ring-sky-200/80 dark:bg-sky-900/50 dark:ring-sky-700/60"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-ink-500 dark:text-ink-400">Vacances scolaires Paris</span> —
                  calendrier officiel{" "}
                  <abbr title="Créteil, Montpellier, Paris, Toulouse, Versailles" className="no-underline">
                    zone&nbsp;C
                  </abbr>
                  . Survol d’un jour pour la période (Toussaint, Noël, hiver, printemps, été).
                </span>
              </p>
              <div className="mt-3 flex max-w-[260px] flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] text-ink-500 dark:text-white/50 sm:justify-start">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]" aria-hidden />
                  Facturé
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-sky-500" aria-hidden />
                  Prévu
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-orange-400" aria-hidden />
                  Congé
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-rose-500" aria-hidden />
                  Non rentable
                </span>
              </div>
            </div>
          </div>

          {/* Mois sélectionné : brut TJM + IK — à droite du calendrier (sm+) */}
          <div className="min-w-0 w-full sm:max-w-sm sm:flex-1 lg:max-w-[300px]">
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-ink-200/80 bg-white p-3 shadow-sm ring-1 ring-black/[0.02] dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none dark:ring-white/[0.05] sm:p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Mois sélectionné
              </p>
              <p className="mt-1 text-[11px] leading-snug text-ink-600 dark:text-ink-300">
                {selectedViewMonthStats.isCurrent ? (
                  <>
                    Jusqu’au{" "}
                    <span className="font-medium text-ink-800 dark:text-ink-200">
                      {selectedViewMonthStats.todayLongFr}
                    </span>
                    , vous avez coché{" "}
                    <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} travaillé
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""} (
                    <span className="capitalize text-ink-800 dark:text-ink-200">
                      {selectedViewMonthStats.monthTitle}
                    </span>
                    ).
                  </>
                ) : selectedViewMonthStats.isPast ? (
                  <>
                    Pour{" "}
                    <span className="font-medium capitalize text-ink-800 dark:text-ink-200">
                      {selectedViewMonthStats.monthTitle}
                    </span>
                    , vous avez coché{" "}
                    <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} travaillé
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""}.
                  </>
                ) : (
                  <>
                    <span className="font-medium capitalize text-ink-800 dark:text-ink-200">
                      {selectedViewMonthStats.monthTitle}
                    </span>{" "}
                    :{" "}
                    <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} coché
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""} sur ce mois (planification).
                  </>
                )}
              </p>

              <div className="mt-3 space-y-2.5 border-t border-ink-100 pt-3 dark:border-ink-800">
                {/* TJM */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200/80 bg-emerald-50 text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <BriefcaseBusiness className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">TJM (HT)</p>
                    <p className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-ink-50">
                      {fmt.euro(brutTjmMoisEncoursHt)}
                    </p>
                    <p className="text-[10px] text-ink-400 dark:text-ink-500">
                      {fmt.int(selectedViewMonthStats.countedDays)} j. × {fmt.euro(tjmHt)}
                    </p>
                    <WorkdaysMonthGauge
                      isCurrent={tjmWorkdayGauge.isCurrent}
                      countedBillable={tjmWorkdayGauge.countedBillable}
                      remainingBillable={tjmWorkdayGauge.remainingBillable}
                      totalBillableMonth={tjmWorkdayGauge.totalBillableMonth}
                    />
                  </div>
                </div>

                {/* IK */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-200/80 bg-violet-50 text-violet-600 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-400">
                    <CarFront className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">IK aller-retour</p>
                    <p className="font-display text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">
                      {fmt.euro(ikMoisEncours)}
                    </p>
                    <p className="text-[10px] text-ink-400 dark:text-ink-500">
                      {fmt.int(selectedViewMonthStats.countedDays)} j. × {fmt.euro(ikPerDay)}
                    </p>
                    <BudgetGauge
                      label="Jauge IK"
                      valueEur={ikMoisEncours}
                      referenceEur={IK_REFERENCE_EUR}
                      tone="analyze"
                    />
                  </div>
                </div>

                {/* Repas + NDF */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-600 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-400">
                    <Utensils className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">Repas &amp; NDF</p>
                    <p className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-ink-50">
                      {fmt.euro(mealFeesForViewedMonth?.total ?? 0)}
                    </p>
                    {mealFeesForViewedMonth ? (
                      <p className="text-[10px] text-ink-400 dark:text-ink-500">
                        Dirigeant {fmt.euro(mealFeesForViewedMonth.dirigeant)} · NDF{" "}
                        {fmt.euro(mealFeesForViewedMonth.ndfAffiche)}
                      </p>
                    ) : null}
                    <BudgetGauge
                      label="Jauge repas + NDF"
                      valueEur={mealFeesForViewedMonth?.total ?? 0}
                      referenceEur={MEALS_REFERENCE_EUR}
                      tone="emerald"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {treasuryTransactions != null && treasuryScope != null ? (
            <TreasuryVerserPanel
              transactions={treasuryTransactions}
              scope={treasuryScope}
              viewYear={viewYear}
              viewMonth0={viewMonth0}
            />
          ) : null}
          </div>

          {/* Synthèse */}
          <div className="min-w-0 w-full flex-1 lg:min-w-[280px]">
            <div className="flex h-full flex-col justify-center rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 via-white to-analyze-50/30 p-3.5 dark:border-emerald-800/25 dark:bg-gradient-to-br dark:from-emerald-950/15 dark:via-[#0a0f0d] dark:to-[#060808] sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70 dark:text-emerald-400/75">
                Estimation CA HT
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-2">
                <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
                  <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">TJM / jour</p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900 dark:text-ink-50">
                    {fmt.euro(tjmHt)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
                  <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">
                    Mois · {countInMonth} j.
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                    {fmt.euro(revenueMonthHt)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100/90 bg-emerald-50/50 px-3 py-2.5 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:shadow-none sm:col-span-1">
                  <p className="text-[10px] font-medium text-emerald-900/70 dark:text-emerald-300/80">
                    Année {viewYear} · {countInYear} j.
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                    {fmt.euro(revenueYearHt)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-ink-500 dark:text-ink-400">
                {persistToSupabase
                  ? "Données synchronisées avec votre compte (Supabase). Total année = jours cochés en "
                  : "Données enregistrées localement (mode démo ou lecture seule). Total année = jours cochés en "}
                {viewYear}.
              </p>
            </div>
          </div>
        </div>

        {treasuryTransactions != null && treasuryScope != null ? (
          <div className="mt-5 border-t border-ink-100/90 pt-5 dark:border-white/[0.06]">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Sélecteur période — même style pill que "Fenêtre d'analyse" */}
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                Période (axe B)
              </span>
              <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-white/[0.1] dark:bg-white/[0.04]">
                <button
                  type="button"
                  aria-pressed={workedDaysChartYear === "all"}
                  onClick={() => setWorkedDaysChartYear("all")}
                  className={clsx(
                    "inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:min-h-0",
                    workedDaysChartYear === "all"
                      ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                      : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                  )}
                >
                  Tout
                </button>
                {workedDaysChartAvailableYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={workedDaysChartYear === y}
                    onClick={() => setWorkedDaysChartYear(y)}
                    className={clsx(
                      "inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:min-h-0",
                      workedDaysChartYear === y
                        ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                        : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Trimestre — visible seulement si une année est sélectionnée */}
              {workedDaysChartYear !== "all" ? (
                <>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                    Trimestre
                  </span>
                  <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-white/[0.1] dark:bg-white/[0.04]">
                    {(["full", 1, 2, 3, 4] as const).map((q) => {
                      const label =
                        q === "full" ? "Année" : q === 1 ? "T1" : q === 2 ? "T2" : q === 3 ? "T3" : "T4";
                      const on = workedDaysChartQuarter === q;
                      return (
                        <button
                          key={String(q)}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setWorkedDaysChartQuarter(q)}
                          className={clsx(
                            "inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:min-h-0",
                            on
                              ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                              : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
            <BillableInvoiceWorkedDaysChart
              data={chartWorkedDaysData}
              averageDaysPerMonth={invoiceWorkedDaysAvg}
              monthsInView={encaisseMonthsInView}
              totalWorkedDaysInPeriod={totalWorkedDaysInPeriod}
              periodLabel={workedDaysChartPeriodLabelText}
              emptyHint={
                chartWorkedDaysData.length === 0 && invoiceWorkedDaysSeries.length > 0
                  ? "filter"
                  : "default"
              }
            />
          </div>
        ) : null}

          <div
            className="sticky bottom-0 z-[8] mt-6 isolate rounded-2xl border border-ink-200/80 bg-white/95 px-3 py-3 text-ink-900 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/[0.12] dark:bg-[#111111] dark:text-zinc-100 dark:shadow-[0_12px_48px_-10px_rgba(0,0,0,0.65)] dark:ring-1 dark:ring-white/[0.06]"
          >
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                { k: "Jours travaillés", v: String(calendarStickyKpis.jours) },
                { k: "CA estimé", v: fmt.euro(calendarStickyKpis.caEstime) },
                { k: "Reste à facturer", v: fmt.euro(calendarStickyKpis.resteAFacturer) },
                { k: "Projection fin de mois", v: fmt.euro(calendarStickyKpis.projectionFinMois) }
              ].map((row) => (
                <div key={`sticky-${row.k}`} className="min-w-0">
                  <dt className="truncate text-[10px] font-medium text-ink-600 dark:text-zinc-400">{row.k}</dt>
                  <dd className="mt-0.5 truncate font-display text-sm font-semibold tabular-nums text-ink-950 dark:text-white sm:text-base">
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
      </CardBody>
    </Card>
  );
}
