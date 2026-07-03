"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { dashboardSectionStack } from "@/lib/dashboard-surfaces";
import { useBillableActivity } from "@/components/dashboard/BillableActivityContext";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import {
  isBillableWorkdayIso,
  listBillableIsosInMonth,
  moveFocusIsoInMonth,
  monthTitleFr,
  toBillableIso,
  workedDaysChartPeriodLabel,
  type CalendarMonthCell
} from "@/lib/billable-calendar-metrics";
import {
  commuteRoundTripKm,
  indemniteKmPerWorkDayForAnnualDaysEur
} from "@/lib/pluxee-commute-indemnity";
import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
import { getParisZoneCSchoolVacationLabel } from "@/lib/fr-school-holidays-paris";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { IK_CATEGORY_LABEL } from "@/lib/expense-category-map";
import { ActivityMonthSummaryCard } from "@/components/dashboard/ActivityMonthSummaryCard";
import { BillableInvoiceWorkedDaysChart } from "@/components/dashboard/BillableInvoiceWorkedDaysChart";
import { HiwayInvoicesBlock } from "@/components/dashboard/HiwayInvoicesBlock";
import { useHiwayInvoices } from "@/components/dashboard/HiwayInvoicesContext";
import { localMonthKey, sumHiwayInvoiceHtForMonth } from "@/lib/hiway-invoice-aggregate";
import {
  appendAgendaWorkedDayMonths,
  buildInvoiceWorkedDaysPastMonthsSeries
} from "@/lib/invoice-worked-days-series";
import {
  listPendingNdfCandidatesForMonth,
  summarizeNdfDigitProForMonth
} from "@/lib/ndf-digitpro";

/** En-têtes courts (2 lettres), calendrier compact. */
const WEEKDAYS_SHORT = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"] as const;

type CalendarPaintMode = "billable" | "vacation";

function monthMatrix(year: number, month0: number): CalendarMonthCell[] {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  return cells;
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
    vacationDays,
    setVacationDays,
    tjmHt,
    billableRatePeriods,
    persistToSupabase
  } = useBillableActivity();
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth0, setViewMonth0] = useState(now.getMonth());
  const fmt = useDashboardDisplayFormat();
  const matrix = useMemo(() => monthMatrix(viewYear, viewMonth0), [viewYear, viewMonth0]);

  const publicHolidays = useMemo(() => getFrenchPublicHolidaysForYear(viewYear), [viewYear]);

  /**
   * Mois affiché dans le calendrier : jours facturés (verts), hors vacances personnelles.
   */
  const selectedViewMonthStats = useMemo(() => {
    const d = new Date();
    const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
    const monthTitle = monthTitleFr(viewYear, viewMonth0);

    let countedDays = 0;
    for (const iso of selected) {
      if (!iso.startsWith(prefix)) continue;
      if (vacationDays.has(iso)) continue;
      if (!isBillableWorkdayIso(iso, publicHolidays)) continue;
      countedDays++;
    }

    const todayLongFr = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(d);

    const nowY = d.getFullYear();
    const nowM0 = d.getMonth();
    const isPast = viewYear < nowY || (viewYear === nowY && viewMonth0 < nowM0);
    const isCurrent = viewYear === nowY && viewMonth0 === nowM0;

    return { countedDays, monthTitle, isPast, isCurrent, todayLongFr };
  }, [publicHolidays, selected, vacationDays, viewYear, viewMonth0]);

  /**
   * Kilométrage annuel automatique : un aller-retour par jour facturé/saisi dans le
   * calendrier, sur l'année affichée. Détermine la tranche du barème fiscal.
   */
  const annualBilledDays = useMemo(() => {
    const prefix = `${viewYear}-`;
    let count = 0;
    for (const iso of selected) {
      if (!iso.startsWith(prefix)) continue;
      if (vacationDays.has(iso)) continue;
      count++;
    }
    return count;
  }, [selected, vacationDays, viewYear]);
  const annualKm = useMemo(
    () => Math.round(annualBilledDays * commuteRoundTripKm()),
    [annualBilledDays]
  );
  const ikPerDay = useMemo(
    () => indemniteKmPerWorkDayForAnnualDaysEur(annualBilledDays),
    [annualBilledDays]
  );
  const ikMoisEncours = Math.round(selectedViewMonthStats.countedDays * ikPerDay * 100) / 100;

  const mealFeesForViewedMonth = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return null;
    const monthKey = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}`;

    let dirigeant = 0;
    for (const tx of treasuryTransactions) {
      if (tx.amount >= 0) continue;
      if (tx.date.slice(0, 7) !== monthKey) continue;
      if ((tx.scope ?? "pro") !== treasuryScope) continue;
      if (deriveExpenseBucket(tx) === "Repas dirigeant") {
        dirigeant += Math.abs(tx.amount);
      }
    }

    /** Notes de frais DigitPro taguées dans Catégorisation (toutes sources), dédoublonnées. */
    const ndf = summarizeNdfDigitProForMonth(treasuryTransactions, monthKey);
    const pendingNdfTransactions = listPendingNdfCandidatesForMonth(
      treasuryTransactions,
      monthKey,
      treasuryScope
    );

    return {
      dirigeant,
      repasTotal: dirigeant,
      ndfDigitPro: ndf.totalEur,
      ndfAffiche: ndf.totalEur,
      ndfTransactions: ndf.transactions,
      pendingNdfTransactions,
      /** Repas dirigeant du mois affiché + NDF DigitPro reclassées sur le même mois. */
      total: dirigeant + ndf.totalEur
    };
  }, [treasuryTransactions, treasuryScope, viewYear, viewMonth0]);

  /** Clés des 12 derniers mois **complétés** (mois en cours exclu) pour les plafonds moyens. */
  const trailing12MonthKeys = useMemo(() => {
    const keys: string[] = [];
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 1; i <= 12; i++) {
      d.setMonth(d.getMonth() - 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
  }, [now]);

  /**
   * Plafond IK = moyenne mensuelle des indemnités kilométriques **réellement versées**, calculée
   * sur les **seuls mois disposant de données** (≤ 12 derniers mois) pour ne pas écraser la moyenne
   * quand l'historique est court (ex. activité récente de 2 mois).
   */
  const ikReference = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return { eur: 0, months: 0 };
    const keySet = new Set(trailing12MonthKeys);
    const perMonth = new Map<string, number>();
    for (const tx of treasuryTransactions) {
      if (tx.amount >= 0) continue;
      if ((tx.scope ?? "pro") !== treasuryScope) continue;
      const key = tx.date.slice(0, 7);
      if (!keySet.has(key)) continue;
      if (deriveExpenseBucket(tx) === IK_CATEGORY_LABEL) {
        perMonth.set(key, (perMonth.get(key) ?? 0) + Math.abs(tx.amount));
      }
    }
    const months = perMonth.size;
    if (months <= 0) return { eur: 0, months: 0 };
    let total = 0;
    for (const v of perMonth.values()) total += v;
    return { eur: Math.round((total / months) * 100) / 100, months };
  }, [treasuryTransactions, treasuryScope, trailing12MonthKeys]);

  /**
   * Plafond Repas = moyenne mensuelle des **Repas dirigeant + Repas d'affaire** réellement versés,
   * sur les seuls mois disposant de données (≤ 12 derniers mois).
   */
  const mealsReference = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return { eur: 0, months: 0 };
    const keySet = new Set(trailing12MonthKeys);
    const perMonth = new Map<string, number>();
    for (const tx of treasuryTransactions) {
      if (tx.amount >= 0) continue;
      if ((tx.scope ?? "pro") !== treasuryScope) continue;
      const key = tx.date.slice(0, 7);
      if (!keySet.has(key)) continue;
      const bucket = deriveExpenseBucket(tx);
      if (bucket === "Repas dirigeant" || bucket === "Repas d'affaire") {
        perMonth.set(key, (perMonth.get(key) ?? 0) + Math.abs(tx.amount));
      }
    }
    const months = perMonth.size;
    if (months <= 0) return { eur: 0, months: 0 };
    let total = 0;
    for (const v of perMonth.values()) total += v;
    return { eur: Math.round((total / months) * 100) / 100, months };
  }, [treasuryTransactions, treasuryScope, trailing12MonthKeys]);

  const calendarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    mode: "add" | "remove";
    moved: boolean;
    startIso: string;
  }>({ active: false, mode: "add", moved: false, startIso: "" });
  const [focusedIso, setFocusedIso] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [paintMode, setPaintMode] = useState<CalendarPaintMode>("billable");

  const toggleDay = useCallback(
    (iso: string) => {
      if (paintMode === "vacation") {
        setVacationDays((prev) => {
          const next = new Set(prev);
          if (next.has(iso)) next.delete(iso);
          else next.add(iso);
          return next;
        });
        setSelected((prev) => {
          if (!prev.has(iso)) return prev;
          const next = new Set(prev);
          next.delete(iso);
          return next;
        });
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(iso)) next.delete(iso);
          else next.add(iso);
          return next;
        });
        setVacationDays((prev) => {
          if (!prev.has(iso)) return prev;
          const next = new Set(prev);
          next.delete(iso);
          return next;
        });
      }
    },
    [paintMode, setSelected, setVacationDays]
  );

  const applyDayPaint = useCallback(
    (iso: string, mode: "add" | "remove") => {
      if (paintMode === "vacation") {
        setVacationDays((prev) => {
          const next = new Set(prev);
          if (mode === "add") next.add(iso);
          else next.delete(iso);
          return next;
        });
        if (mode === "add") {
          setSelected((prev) => {
            if (!prev.has(iso)) return prev;
            const next = new Set(prev);
            next.delete(iso);
            return next;
          });
        }
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          if (mode === "add") next.add(iso);
          else next.delete(iso);
          return next;
        });
        if (mode === "add") {
          setVacationDays((prev) => {
            if (!prev.has(iso)) return prev;
            const next = new Set(prev);
            next.delete(iso);
            return next;
          });
        }
      }
    },
    [paintMode, setSelected, setVacationDays]
  );

  const selectAllBillableInMonth = useCallback(() => {
    const billableIsos = listBillableIsosInMonth(viewYear, viewMonth0, publicHolidays);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const iso of billableIsos) next.add(iso);
      return next;
    });
    setVacationDays((prev) => {
      const next = new Set(prev);
      for (const iso of billableIsos) next.delete(iso);
      return next;
    });
  }, [publicHolidays, setSelected, setVacationDays, viewMonth0, viewYear]);

  const handleDayPointerDown = useCallback(
    (iso: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const active =
        paintMode === "vacation" ? vacationDays.has(iso) : selected.has(iso);
      const mode = active ? "remove" : "add";
      dragRef.current = { active: true, mode, moved: false, startIso: iso };
      setIsDragging(true);
      setFocusedIso(iso);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [paintMode, selected, vacationDays]
  );

  const handleDayPointerEnter = useCallback(
    (iso: string) => {
      if (!dragRef.current.active) return;
      dragRef.current.moved = true;
      applyDayPaint(iso, dragRef.current.mode);
      setFocusedIso(iso);
    },
    [applyDayPaint]
  );

  const endDrag = useCallback(
    (iso?: string) => {
      if (!dragRef.current.active) return;
      if (!dragRef.current.moved && (iso ?? dragRef.current.startIso)) {
        toggleDay(iso ?? dragRef.current.startIso);
      }
      dragRef.current = { active: false, mode: "add", moved: false, startIso: "" };
      setIsDragging(false);
    },
    [toggleDay]
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
    setVacationDays((prev) => {
      const next = new Set(prev);
      for (const d of prev) {
        if (d.startsWith(prefix)) next.delete(d);
      }
      return next;
    });
  }, [setSelected, setVacationDays, viewYear, viewMonth0]);

  const goPrevMonth = useCallback(() => {
    if (viewMonth0 === 0) {
      setViewMonth0(11);
      setViewYear((y) => y - 1);
    } else setViewMonth0((m) => m - 1);
  }, [viewMonth0]);

  const goNextMonth = useCallback(() => {
    if (viewMonth0 === 11) {
      setViewMonth0(0);
      setViewYear((y) => y + 1);
    } else setViewMonth0((m) => m + 1);
  }, [viewMonth0]);

  const goToday = useCallback(() => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth0(t.getMonth());
    setFocusedIso(toBillableIso(t.getFullYear(), t.getMonth(), t.getDate()));
  }, []);

  const clock = new Date();
  const todayIsoLive = toBillableIso(clock.getFullYear(), clock.getMonth(), clock.getDate());

  useEffect(() => {
    if (focusedIso == null) setFocusedIso(todayIsoLive);
  }, [focusedIso, todayIsoLive]);

  useEffect(() => {
    const prefix = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}-`;
    if (focusedIso?.startsWith(prefix)) return;
    setFocusedIso(`${prefix}01`);
  }, [focusedIso, viewMonth0, viewYear]);

  useEffect(() => {
    const onPointerUp = () => endDrag();
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [endDrag]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const inCalendar =
        calendarRef.current?.contains(document.activeElement) ||
        calendarRef.current?.contains(event.target as Node);

      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevMonth();
        return;
      }

      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        goNextMonth();
        return;
      }

      if (inCalendar && focusedIso) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setFocusedIso(moveFocusIsoInMonth(focusedIso, "ArrowLeft", viewYear, viewMonth0));
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setFocusedIso(moveFocusIsoInMonth(focusedIso, "ArrowRight", viewYear, viewMonth0));
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setFocusedIso(moveFocusIsoInMonth(focusedIso, "ArrowUp", viewYear, viewMonth0));
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setFocusedIso(moveFocusIsoInMonth(focusedIso, "ArrowDown", viewYear, viewMonth0));
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggleDay(focusedIso);
          return;
        }
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        goToday();
        return;
      }

      if (event.key.toLowerCase() === "v" && inCalendar) {
        event.preventDefault();
        setPaintMode((m) => (m === "billable" ? "vacation" : "billable"));
        return;
      }

      if (event.key.toLowerCase() === "a" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        selectAllBillableInMonth();
        return;
      }

      if (event.key === "Delete" || (event.key === "Backspace" && inCalendar)) {
        event.preventDefault();
        clearMonth();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearMonth,
    focusedIso,
    goNextMonth,
    goPrevMonth,
    goToday,
    selectAllBillableInMonth,
    toggleDay,
    viewMonth0,
    viewYear
  ]);

  const { invoices: hiwayInvoices } = useHiwayInvoices();
  /** CA HT facturé (Hiway) sur le mois civil en cours, pour requalifier la barre « À facturer ». */
  const currentMonthInvoiceCaHt = useMemo(
    () => sumHiwayInvoiceHtForMonth(hiwayInvoices, localMonthKey(now)),
    [hiwayInvoices, now]
  );

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
    const withAgenda = appendAgendaWorkedDayMonths(
      filteredInvoiceWorkedDaysSeries,
      selected,
      billableRatePeriods,
      tjmHt
    );
    // Si une facture Hiway a été émise sur le mois en cours, la barre « À facturer »
    // (estimation agenda) devient « Déjà facturé » au montant réel de la facture.
    const currentKey = localMonthKey(now);
    const withInvoice =
      currentMonthInvoiceCaHt > 0
        ? withAgenda.map((row) => {
            if (row.monthKey !== currentKey || row.kind !== "a_facturer") return row;
            const tjm = row.tjmHt > 0 ? row.tjmHt : tjmHt;
            return {
              ...row,
              kind: "deja_facture" as const,
              caHt: currentMonthInvoiceCaHt,
              days: tjm > 0 ? Math.round((currentMonthInvoiceCaHt / tjm) * 10) / 10 : row.days
            };
          })
        : withAgenda;
    if (workedDaysChartYear === "all") return withInvoice;
    let rows = withInvoice.filter((r) => r.monthKey.startsWith(`${workedDaysChartYear}-`));
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
    currentMonthInvoiceCaHt,
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
    <div className={dashboardSectionStack}>
      <div className="flex w-full flex-col flex-wrap items-stretch gap-8 sm:flex-row sm:items-start sm:gap-10">
          {/* Calendrier compact */}
          <div className="flex shrink-0 flex-col items-center sm:items-start">
            <div
              ref={calendarRef}
              tabIndex={0}
              className={clsx(
                "w-full max-w-[300px] p-1 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
                isDragging && "select-none touch-none"
              )}
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

              <div
                className="mb-2 flex justify-center"
                role="group"
                aria-label="Mode de saisie calendrier"
              >
                <div className="inline-flex rounded-full border border-ink-200/70 bg-ink-50/80 p-0.5 dark:border-white/[0.1] dark:bg-white/[0.05]">
                  {(
                    [
                      { id: "billable" as const, label: "Facturé" },
                      { id: "vacation" as const, label: "Vacances" }
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={paintMode === item.id}
                      onClick={() => setPaintMode(item.id)}
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                        paintMode === item.id
                          ? item.id === "vacation"
                            ? "bg-sky-500 text-white shadow-sm dark:bg-sky-500/90"
                            : "bg-emerald-500 text-white shadow-sm dark:bg-emerald-500/90"
                          : "text-ink-500 hover:text-ink-800 dark:text-white/45 dark:hover:text-white/75"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
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
                  const isPersonalVacation = vacationDays.has(iso);
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
                    schoolVacLabel ? schoolVacLabel : null,
                    isPersonalVacation ? "vacances personnelles" : null
                  ]
                    .filter(Boolean)
                    .join(", ");

                  const billable = isBillableWorkdayIso(iso, publicHolidays);
                  const pastMissed =
                    billable &&
                    !on &&
                    !isPersonalVacation &&
                    !isHoliday &&
                    !isSchoolVacation &&
                    iso < todayIsoLive;
                  const futurePlanned =
                    billable &&
                    !on &&
                    !isPersonalVacation &&
                    !isHoliday &&
                    !isSchoolVacation &&
                    iso >= todayIsoLive;
                  const heat =
                    billable && !isPersonalVacation
                      ? Math.min(1, 0.15 + (on ? 0.55 : pastMissed ? 0.35 : futurePlanned ? 0.25 : 0.12))
                      : 0;
                  const isFocused = focusedIso === iso;

                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={paintMode === "vacation" ? isPersonalVacation : on}
                      title={dayTitle}
                      tabIndex={isFocused ? 0 : -1}
                      aria-label={`${iso}${ariaExtra ? `, ${ariaExtra}` : ""}${
                        isPersonalVacation ? ", vacances" : on ? ", facturé" : ""
                      }${isToday ? ", aujourd’hui" : ""}${isFocused ? ", focus clavier" : ""}`}
                      onPointerDown={(event) => handleDayPointerDown(iso, event)}
                      onPointerEnter={() => handleDayPointerEnter(iso)}
                      onPointerUp={() => endDrag(iso)}
                      onFocus={() => setFocusedIso(iso)}
                      style={heat > 0 ? { boxShadow: `inset 0 0 0 999px rgba(16,185,129,${heat * 0.12})` } : undefined}
                      className={clsx(
                        "relative flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0a0a0a]",
                        isFocused && "z-[2] ring-2 ring-emerald-300/80 ring-offset-1 dark:ring-emerald-400/70",
                        isDragging && "cursor-crosshair",
                        isPersonalVacation
                          ? clsx(
                              "bg-sky-50 font-semibold text-sky-950 ring-2 ring-sky-400/85 dark:bg-sky-950/55 dark:text-sky-100 dark:ring-sky-400/70",
                              isToday &&
                                "ring-2 ring-brand-400 ring-offset-1 dark:ring-brand-300 dark:ring-offset-[#0a0a0a]"
                            )
                          : on
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
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-sky-100 ring-2 ring-sky-400/80 dark:bg-sky-900/50 dark:ring-sky-400/70"
                  aria-hidden
                />
                Mes vacances
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

          <div className="min-w-0 w-full sm:max-w-sm sm:flex-1 lg:max-w-[340px]">
            <ActivityMonthSummaryCard
              countedDays={selectedViewMonthStats.countedDays}
              ikTotalEur={ikMoisEncours}
              ikPerDayEur={ikPerDay}
              annualKm={annualKm}
              annualBilledDays={annualBilledDays}
              mealFees={mealFeesForViewedMonth}
              ikReferenceEur={ikReference.eur}
              ikReferenceMonths={ikReference.months}
              mealsReferenceEur={mealsReference.eur}
              mealsReferenceMonths={mealsReference.months}
            />
          </div>
      </div>

        {treasuryTransactions != null && treasuryScope != null ? (
          <div className="mt-8 space-y-4">
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

      <HiwayInvoicesBlock />
    </div>
  );
}
