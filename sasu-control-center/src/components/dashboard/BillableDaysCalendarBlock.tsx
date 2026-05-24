"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  COMMUTE_HOME_LABEL,
  COMMUTE_WORK_LABEL,
  commuteRoundTripKm,
  indemniteKmPerWorkDayEur
} from "@/lib/pluxee-commute-indemnity";
import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
import { getParisZoneCSchoolVacationLabel } from "@/lib/fr-school-holidays-paris";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { ActivityOverviewPremium } from "@/components/dashboard/ActivityOverviewPremium";
import {
  appendAgendaWorkedDayMonths,
  buildInvoiceWorkedDaysPastMonthsSeries
} from "@/lib/invoice-worked-days-series";
import { resolveBillableTjmForClientMonth } from "@/lib/billable-client-days";

const BillableInvoiceWorkedDaysChart = dynamic(
  () =>
    import("@/components/dashboard/BillableInvoiceWorkedDaysChart").then(
      (m) => m.BillableInvoiceWorkedDaysChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[11.5rem] w-full animate-pulse rounded-2xl bg-ink-100/70 dark:bg-white/[0.05] sm:h-52" />
    )
  }
);

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
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink-500 dark:text-cyan-50/55">
        <span className="font-semibold text-ink-600 dark:text-cyan-50/70">Jauge j. ouvrés cochés / reste</span>
        <span className="tabular-nums text-[10px]">
          {denomLabel} · {pctLabel}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-black/[0.04] dark:bg-[#06242b]/65 dark:ring-cyan-100/[0.10]">
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
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink-500 dark:text-cyan-50/55">
        <span className="font-semibold text-ink-600 dark:text-cyan-50/70">{label}</span>
        <span className="tabular-nums">
          {fmt.euro(valueEur)} / {fmt.euro(referenceEur)} · {pctLabel}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-black/[0.04] dark:bg-[#06242b]/65 dark:ring-cyan-100/[0.10]">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

/** Dépenses Powens reclassées explicitement en « NDF DigitPro » pour le mois affiché. */
function isPowensNdfDigitProInMonth(tx: DashboardTx, monthKey: string): boolean {
  if (tx.amount >= 0) return false;
  if (tx.date.slice(0, 7) !== monthKey) return false;
  if (tx.importFormat !== "powens") return false;
  return tx.category === "NDF DigitPro";
}

function cleanNdfMerchantLabel(raw: string): string {
  return raw
    .replace(/\b(cb|carte|card|cblm|paiement|payment)\b/gi, " ")
    .replace(/\b\d{2,}\/\d{2,}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim() || raw;
}

export function BillableDaysCalendarBlock({
  treasuryTransactions,
  treasuryScope
}: {
  /** Mouvements pour le bloc trésorerie (solde, CA, TVA). */
  treasuryTransactions?: DashboardTx[];
  treasuryScope?: "pro" | "personal";
}) {
  const {
    selected,
    setSelected,
    tjmHt,
    billableRatePeriods,
    persistToSupabase,
    overviewMonthTitle,
    overviewKpis,
    overviewWorkdayGauge
  } = useBillableActivity();
  const now = useMemo(() => new Date(), []);
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
  const ikRoundTripKm = commuteRoundTripKm();
  const ikMoisEncours = selectedViewMonthStats.countedDays * ikPerDay;

  const mealFeesForViewedMonth = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return null;
    const monthKey = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}`;
    let dirigeant = 0;
    let ndfDigitPro = 0;
    const ndfTransactions: DashboardTx[] = [];
    const ndfDedupeKeys = new Set<string>();
    for (const tx of treasuryTransactions) {
      if (tx.amount >= 0) continue;
      const d = tx.date.slice(0, 7);
      const amt = Math.abs(tx.amount);
      if ((tx.scope ?? "pro") === treasuryScope && d === monthKey && deriveExpenseBucket(tx) === "Repas dirigeant") {
        dirigeant += amt;
      }
      if (isPowensNdfDigitProInMonth(tx, monthKey)) {
        const dedupeKey = `${cleanNdfMerchantLabel(tx.label).toLowerCase()}|${tx.date}|${amt.toFixed(2)}`;
        if (!ndfDedupeKeys.has(dedupeKey)) {
          ndfDedupeKeys.add(dedupeKey);
          ndfDigitPro += amt;
          ndfTransactions.push(tx);
        }
      }
    }

    const repasTotal = dirigeant;
    return {
      dirigeant,
      repasTotal,
      ndfDigitPro,
      ndfAffiche: ndfDigitPro,
      ndfTransactions,
      /** Repas dirigeant du mois affiché + transactions reclassées NDF DigitPro sur le même mois. */
      total: repasTotal + ndfDigitPro
    };
  }, [treasuryTransactions, treasuryScope, viewYear, viewMonth0]);

  const calendarStickyKpis = useMemo(
    () => computeCalendarStickyKpis(selected, tjmHt, viewYear, viewMonth0),
    [selected, tjmHt, viewYear, viewMonth0]
  );

  const toggleDay = useCallback(
    (iso: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(iso)) next.delete(iso);
        else next.add(iso);
        return next;
      });
    },
    [setSelected]
  );

  const clearMonth = useCallback(() => {
    const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of prev) {
        if (d.startsWith(prefix)) next.delete(d);
      }
      return next;
    });
  }, [setSelected, viewYear, viewMonth0]);

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
    return buildInvoiceWorkedDaysPastMonthsSeries(
      treasuryTransactions,
      treasuryScope,
      new Date(),
      undefined,
      billableRatePeriods,
      tjmHt
    );
  }, [billableRatePeriods, tjmHt, treasuryTransactions, treasuryScope]);

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
    const agendaTjmHt = resolveBillableTjmForClientMonth(
      billableRatePeriods,
      billableRatePeriods[0]?.clientName ?? "",
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      tjmHt
    );
    const withAgenda = appendAgendaWorkedDayMonths(filteredInvoiceWorkedDaysSeries, selected, agendaTjmHt);
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
    billableRatePeriods,
    now,
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
    <div className="space-y-5">
      <ActivityOverviewPremium
        monthTitle={overviewMonthTitle}
        kpis={overviewKpis}
        workdayGauge={overviewWorkdayGauge}
        ctaMode="hidden"
      />

    <Card variant="solid" className="overflow-hidden">
      <CardHeader className="border-b border-ink-100/80 bg-gradient-to-b from-ink-50/80 to-white pb-4 dark:border-cyan-100/[0.12] dark:bg-[#06242b]/70 dark:bg-none">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50/90 text-emerald-700 shadow-sm dark:border-teal-200/[0.16] dark:bg-teal-200/[0.10] dark:text-teal-100 dark:shadow-none"
            aria-hidden
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="!mt-0 text-base font-bold tracking-tight text-ink-900 dark:text-white">
              Jours travaillés & TJM
            </CardTitle>
            <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-ink-500 dark:text-cyan-50/62 sm:text-xs">
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
              className="w-full max-w-[260px] rounded-2xl border border-ink-200/70 bg-white/90 p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03] dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:ring-cyan-100/[0.06] sm:p-3.5"
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
            <div className="mt-2 flex max-w-[238px] flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] leading-snug text-ink-500 dark:text-white/50 sm:justify-start">
              <span className="inline-flex items-center gap-1">
                <span
                  className="relative inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(59,130,246,0.55)] ring-2 ring-brand-500/35 dark:bg-brand-400 dark:shadow-[0_0_8px_rgba(96,165,250,0.45)] dark:ring-brand-400/40"
                  aria-hidden
                />
                Aujourd’hui
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-amber-100 ring-1 ring-amber-200/80 dark:bg-amber-900/60 dark:ring-amber-700/60"
                  aria-hidden
                />
                Férié
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-sky-100 ring-1 ring-sky-200/80 dark:bg-sky-900/50 dark:ring-sky-700/60"
                  aria-hidden
                />
                Vacances
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]" aria-hidden />
                Facturé
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded bg-sky-500" aria-hidden />
                Prévu
              </span>
            </div>
          </div>

          {/* Mois sélectionné : brut TJM + IK — à droite du calendrier (sm+) */}
          <div className="min-w-0 w-full sm:max-w-sm sm:flex-1 lg:max-w-[300px]">
            <div className="flex h-full min-h-0 flex-col rounded-[1.75rem] border border-ink-200/80 bg-white p-3 shadow-sm ring-1 ring-black/[0.02] dark:border-cyan-100/[0.14] dark:bg-[#06242b] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:ring-cyan-100/[0.08] sm:p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-500 dark:text-cyan-50/70">
                Mois sélectionné
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-snug text-ink-600 dark:text-white/82">
                {selectedViewMonthStats.isCurrent ? (
                  <>
                    Jusqu’au{" "}
                    <span className="font-bold text-ink-800 dark:text-white">
                      {selectedViewMonthStats.todayLongFr}
                    </span>
                    , vous avez coché{" "}
                    <span className="font-extrabold tabular-nums text-ink-900 dark:text-teal-100">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} travaillé
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""} (
                    <span className="capitalize text-ink-800 dark:text-white">
                      {selectedViewMonthStats.monthTitle}
                    </span>
                    ).
                  </>
                ) : selectedViewMonthStats.isPast ? (
                  <>
                    Pour{" "}
                    <span className="font-bold capitalize text-ink-800 dark:text-white">
                      {selectedViewMonthStats.monthTitle}
                    </span>
                    , vous avez coché{" "}
                    <span className="font-extrabold tabular-nums text-ink-900 dark:text-teal-100">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} travaillé
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""}.
                  </>
                ) : (
                  <>
                    <span className="font-bold capitalize text-ink-800 dark:text-white">
                      {selectedViewMonthStats.monthTitle}
                    </span>{" "}
                    :{" "}
                    <span className="font-extrabold tabular-nums text-ink-900 dark:text-teal-100">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} coché
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""} sur ce mois (planification).
                  </>
                )}
              </p>

              <div className="mt-3 space-y-3 border-t border-ink-100 pt-3 dark:border-cyan-100/[0.12]">
                {/* TJM */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-600 dark:border-teal-200/[0.16] dark:bg-teal-200/[0.10] dark:text-teal-100">
                    <BriefcaseBusiness className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-ink-500 dark:text-white/62">TJM (HT)</p>
                    <p className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-white">
                      {fmt.euro(brutTjmMoisEncoursHt)}
                    </p>
                    <p className="text-[10px] font-medium text-ink-400 dark:text-cyan-50/46">
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
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-violet-200/80 bg-violet-50 text-violet-600 dark:border-violet-200/[0.18] dark:bg-violet-300/[0.12] dark:text-violet-100">
                    <CarFront className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-ink-500 dark:text-white/62">IK aller-retour</p>
                    <p className="font-display text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">
                      {fmt.euro(ikMoisEncours)}
                    </p>
                    <p className="text-[10px] font-medium text-ink-400 dark:text-cyan-50/46">
                      {fmt.int(selectedViewMonthStats.countedDays)} j. × {fmt.euro(ikPerDay)}
                    </p>
                    <BudgetGauge
                      label="Jauge IK"
                      valueEur={ikMoisEncours}
                      referenceEur={IK_REFERENCE_EUR}
                      tone="analyze"
                    />
                    <div className="mt-2.5 overflow-hidden rounded-2xl border border-violet-200/70 bg-white p-2 dark:border-violet-400/15 dark:bg-[#06242b]/55">
                      <div className="relative h-40 overflow-hidden rounded-xl border border-ink-200/70 bg-[#eef3ef] shadow-inner dark:border-cyan-100/[0.08] dark:bg-[#0b3038]">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(100,116,139,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(100,116,139,0.13)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)]" />
                        <div className="absolute -left-10 top-5 h-28 w-32 rounded-[42%] bg-emerald-200/55 dark:bg-emerald-500/10" />
                        <div className="absolute right-1 top-2 h-24 w-28 rounded-[44%] bg-emerald-200/55 dark:bg-emerald-500/10" />
                        <div className="absolute left-2 top-2 rounded-md border border-ink-200/60 bg-white/85 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ink-500 shadow-sm dark:border-cyan-100/[0.10] dark:bg-[#06242b]/55 dark:text-white/55">
                          Carte trajet IK
                        </div>
                        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
                          <path d="M0 70 C 18 55, 30 76, 47 57 S 70 45, 100 55" fill="none" stroke="#7dd3fc" strokeLinecap="round" strokeWidth="7" opacity="0.52" />
                          <path d="M2 28 C 17 25, 32 35, 48 31 S 74 24, 98 29" fill="none" stroke="#facc15" strokeLinecap="round" strokeWidth="4.2" opacity="0.72" />
                          <path d="M8 88 C 26 75, 48 84, 69 72 S 88 61, 100 66" fill="none" stroke="#94a3b8" strokeLinecap="round" strokeWidth="3" opacity="0.6" />
                          <path d="M15 14 C 28 29, 40 17, 52 31 S 76 37, 94 20" fill="none" stroke="#94a3b8" strokeLinecap="round" strokeWidth="2.4" opacity="0.55" />
                          <path d="M17 38 C 32 19, 49 68, 62 49 S 76 48, 84 64" fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeWidth="6" opacity="0.18" />
                          <path d="M17 38 C 32 19, 49 68, 62 49 S 76 48, 84 64" fill="none" stroke="#7c3aed" strokeDasharray="5 4" strokeLinecap="round" strokeWidth="2.7" opacity="0.9" />
                        </svg>
                        <div className="absolute left-[13%] top-[31%] z-[2] h-4 w-4 rounded-full border-[3px] border-white bg-violet-500 shadow-[0_0_18px_rgba(139,92,246,0.65)] dark:border-[#101815]" />
                        <div className="absolute right-[14%] top-[56%] z-[2] h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.65)] dark:border-[#101815]" />
                        <div className="absolute left-[44%] top-[36%] z-[3] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-slate-400/70 bg-gradient-to-b from-slate-700 to-slate-950 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-50 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.85)]">
                          <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-500 bg-slate-100 text-slate-950 shadow-inner">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
                              <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                              <path d="M12 3.5 10.7 11 4.8 17.5 12 14.1l7.2 3.4L13.3 11 12 3.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.35" />
                            </svg>
                          </span>
                          GLB
                        </div>
                        <div className="absolute left-[43%] top-[17%] rounded border border-ink-200/60 bg-white/85 px-1.5 py-0.5 text-[8px] font-bold text-ink-500 shadow-sm dark:border-cyan-100/[0.10] dark:bg-[#06242b]/55 dark:text-white/55">
                          Paris Ouest
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 grid grid-cols-[1fr_auto_1fr] items-end gap-2 text-[9px] font-semibold text-ink-600 dark:text-white/55">
                          <div className="min-w-0">
                            <p className="truncate text-violet-700 dark:text-violet-200">Départ</p>
                            <p className="truncate">{COMMUTE_HOME_LABEL}</p>
                          </div>
                          <div className="rounded-full border border-ink-200/70 bg-white/80 px-2 py-1 text-center text-[9px] font-bold tabular-nums text-ink-700 dark:border-cyan-100/[0.10] dark:bg-[#06242b]/60 dark:text-white/75">
                            {fmt.int(ikRoundTripKm)} km A/R
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="truncate text-emerald-700 dark:text-emerald-200">Arrivée</p>
                            <p className="truncate">{COMMUTE_WORK_LABEL}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Repas + NDF */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-600 dark:border-amber-200/[0.18] dark:bg-amber-300/[0.12] dark:text-amber-100">
                    <Utensils className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-ink-500 dark:text-white/62">Repas &amp; NDF</p>
                    <p className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-white">
                      {fmt.euro(mealFeesForViewedMonth?.total ?? 0)}
                    </p>
                    {mealFeesForViewedMonth ? (
                      <p className="text-[10px] font-medium text-ink-400 dark:text-cyan-50/46">
                        Dirigeant {fmt.euro(mealFeesForViewedMonth.dirigeant)} ·{" "}
                        <span className="group/ndf relative inline-flex cursor-help items-center rounded-full px-1 font-semibold text-emerald-700 ring-1 ring-transparent transition hover:bg-emerald-500/10 hover:ring-emerald-500/20 dark:text-emerald-300">
                          NDF {fmt.euro(mealFeesForViewedMonth.ndfAffiche)}
                          <span className="absolute left-0 top-full z-50 mt-2 hidden w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-ink-200 bg-white p-3 text-left text-[11px] text-ink-700 opacity-0 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.35)] transition group-hover/ndf:block group-hover/ndf:opacity-100 dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:text-white/75">
                            <span className="mb-2 block font-bold text-ink-950 dark:text-white">
                              Transactions NDF DigitPro
                            </span>
                            {mealFeesForViewedMonth.ndfTransactions.length ? (
                              <span className="scrollbar-clean block max-h-72 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                                {mealFeesForViewedMonth.ndfTransactions.map((tx) => (
                                  <span
                                    key={tx.id}
                                    className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-ink-50 px-2 py-1.5 dark:bg-white/[0.05]"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold text-ink-900 dark:text-white">
                                        {cleanNdfMerchantLabel(tx.label)}
                                      </span>
                                      <span className="text-[10px] text-ink-400 dark:text-white/35">{tx.date}</span>
                                    </span>
                                    <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                                      {fmt.euro(Math.abs(tx.amount))}
                                    </span>
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="block text-ink-500 dark:text-white/45">
                                Aucune transaction NDF DigitPro sur ce mois.
                              </span>
                            )}
                          </span>
                        </span>
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

          </div>

          {/* Synthèse */}
          <div className="min-w-0 w-full flex-1 lg:min-w-[280px]">
            <div className="flex h-full flex-col justify-center rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 via-white to-analyze-50/30 p-3.5 dark:border-cyan-100/[0.10] dark:bg-[#0b3038]/86 dark:bg-none sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70 dark:text-emerald-400/75">
                Estimation CA HT
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-2">
                <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.07] dark:shadow-none">
                  <p className="text-[10px] font-medium text-ink-500 dark:text-ink-400">TJM / jour</p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900 dark:text-ink-50">
                    {fmt.euro(tjmHt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.07] dark:shadow-none">
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
              <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-cyan-100/[0.10] dark:bg-[#0b3038]/70">
                <button
                  type="button"
                  aria-pressed={workedDaysChartYear === "all"}
                  onClick={() => setWorkedDaysChartYear("all")}
                  className={clsx(
                    "inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#06242b] sm:min-h-0",
                    workedDaysChartYear === "all"
                      ? "bg-white text-ink-900 shadow-sm dark:bg-cyan-50/[0.12] dark:text-ink-50 dark:shadow-none"
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
                      "inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#06242b] sm:min-h-0",
                      workedDaysChartYear === y
                        ? "bg-white text-ink-900 shadow-sm dark:bg-cyan-50/[0.12] dark:text-ink-50 dark:shadow-none"
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
                  <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-cyan-100/[0.10] dark:bg-[#0b3038]/70">
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
                            "inline-flex min-h-[36px] items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#06242b] sm:min-h-0",
                            on
                              ? "bg-white text-ink-900 shadow-sm dark:bg-cyan-50/[0.12] dark:text-ink-50 dark:shadow-none"
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
            className="sticky bottom-0 z-[8] mt-6 isolate rounded-2xl border border-ink-200/80 bg-white/95 px-3 py-3 text-ink-900 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-cyan-100/[0.12] dark:bg-[#0b3038]/92 dark:text-zinc-100 dark:shadow-[0_12px_48px_-10px_rgba(0,22,28,0.65)] dark:ring-1 dark:ring-cyan-100/[0.08]"
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
    </div>
  );
}
