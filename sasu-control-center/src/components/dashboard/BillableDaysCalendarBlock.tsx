"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatEur } from "@/lib/format";
import { replaceBillableWorkDays } from "@/app/dashboard/actions";
import { indemniteKmPerWorkDayEur } from "@/lib/pluxee-commute-indemnity";
import { getFrenchPublicHolidaysForYear } from "@/lib/fr-public-holidays";
import { getParisZoneCSchoolVacationLabel } from "@/lib/fr-school-holidays-paris";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { TreasuryVerserPanel } from "@/components/dashboard/TreasuryVerserPanel";
import { BillableInvoiceWorkedDaysChart } from "@/components/dashboard/BillableInvoiceWorkedDaysChart";
import { buildInvoiceWorkedDaysPastMonthsSeries } from "@/lib/invoice-worked-days-series";

const STORAGE_KEY = "digitpro:billable-work-days-iso";

/** En-têtes courts (2 lettres), calendrier compact. */
const WEEKDAYS_SHORT = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"] as const;

const IK_REFERENCE_EUR = 550;
const MEALS_REFERENCE_EUR = 650;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
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
  const pct = clamp01(referenceEur > 0 ? valueEur / referenceEur : 0);
  const pctLabel = Math.round(pct * 100);

  const fillClass =
    tone === "analyze"
      ? "bg-analyze-600"
      : tone === "rose"
        ? "bg-rose-600"
        : "bg-emerald-600";

  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink-500">
        <span className="font-medium text-ink-600">{label}</span>
        <span className="tabular-nums">
          {formatEur(valueEur)} / {formatEur(referenceEur)} · {pctLabel}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100 ring-1 ring-black/[0.04]">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function parseStored(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return new Set();
    return new Set(
      a.filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x))
    );
  } catch {
    return new Set();
  }
}

function toIso(y: number, month0: number, day: number): string {
  return `${y}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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

function monthTitleFr(year: number, month0: number): string {
  const raw = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(year, month0, 1)
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function persistSignature(sortedDates: string[], tjm: number): string {
  return sortedDates.join(",") + "|" + tjm;
}

export function BillableDaysCalendarBlock({
  tjmHt,
  persistToSupabase,
  initialWorkDayIsos,
  onWorkDaysChange,
  treasuryTransactions,
  treasuryScope
}: {
  tjmHt: number;
  persistToSupabase: boolean;
  initialWorkDayIsos: string[];
  /** Notifié après hydratation et à chaque changement de sélection (liste triée ISO). */
  onWorkDaysChange?: (sortedIsos: readonly string[]) => void;
  /** Mouvements pour le bloc trésorerie (solde, CA, TVA). */
  treasuryTransactions?: DashboardTx[];
  treasuryScope?: "pro" | "personal";
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth0, setViewMonth0] = useState(now.getMonth());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [, startTransition] = useTransition();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lastPersistedRef = useRef<string | null>(null);

  const serverDaysKey = useMemo(
    () => [...initialWorkDayIsos].sort().join("|"),
    [initialWorkDayIsos]
  );

  useEffect(() => {
    if (persistToSupabase) {
      setSelected(new Set(initialWorkDayIsos));
      lastPersistedRef.current = persistSignature([...initialWorkDayIsos].sort(), tjmHt);
    } else if (typeof window !== "undefined") {
      setSelected(parseStored(localStorage.getItem(STORAGE_KEY)));
      lastPersistedRef.current = null;
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `serverDaysKey` résume `initialWorkDayIsos` (réf. tableau instable).
  }, [persistToSupabase, serverDaysKey, tjmHt]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected].sort()));
  }, [selected, hydrated, persistToSupabase]);

  useEffect(() => {
    if (!hydrated || !persistToSupabase) return;
    const sortedDates = [...selectedRef.current].sort();
    const sig = persistSignature(sortedDates, tjmHt);
    if (sig === lastPersistedRef.current) return;
    const t = setTimeout(() => {
      const toSave = [...selectedRef.current].sort();
      const sigNow = persistSignature(toSave, tjmHt);
      startTransition(() => {
        void replaceBillableWorkDays(toSave, tjmHt)
          .then(() => {
            lastPersistedRef.current = sigNow;
          })
          .catch((e) => {
            toast.error("Enregistrement des jours travaillés impossible", {
              description: e instanceof Error ? e.message : undefined
            });
          });
      });
    }, 500);
    return () => clearTimeout(t);
  }, [selected, hydrated, persistToSupabase, tjmHt]);

  useEffect(() => {
    if (!hydrated || !onWorkDaysChange) return;
    onWorkDaysChange([...selected].sort());
  }, [selected, hydrated, onWorkDaysChange]);

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
    const todayIso = toIso(nowY, nowM0, d.getDate());
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

  const brutTjmMoisEncoursHt = selectedViewMonthStats.countedDays * tjmHt;
  const ikPerDay = indemniteKmPerWorkDayEur();
  const ikMoisEncours = selectedViewMonthStats.countedDays * ikPerDay;

  const mealFeesForViewedMonth = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return null;
    const monthKey = `${viewYear}-${String(viewMonth0 + 1).padStart(2, "0")}`;
    let dirigeant = 0;
    let client = 0;
    for (const tx of treasuryTransactions) {
      if ((tx.scope ?? "pro") !== treasuryScope) continue;
      if (tx.amount >= 0) continue;
      if (!tx.date.startsWith(`${monthKey}-`)) continue;
      const bucket = deriveExpenseBucket(tx);
      const amt = Math.abs(tx.amount);
      if (bucket === "Repas dirigeant") dirigeant += amt;
      else if (bucket === "Repas d'affaire") client += amt;
    }
    return {
      dirigeant,
      client,
      total: dirigeant + client
    };
  }, [treasuryTransactions, treasuryScope, viewYear, viewMonth0]);

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
  const todayIsoLive = toIso(clock.getFullYear(), clock.getMonth(), clock.getDate());

  const invoiceWorkedDaysSeries = useMemo(() => {
    if (treasuryTransactions == null || treasuryScope == null) return [];
    return buildInvoiceWorkedDaysPastMonthsSeries(treasuryTransactions, treasuryScope);
  }, [treasuryTransactions, treasuryScope]);

  return (
    <Card variant="solid" className="overflow-hidden border-ink-200/90 shadow-sm">
      <CardHeader className="border-b border-ink-100/80 bg-gradient-to-b from-ink-50/80 to-white pb-3">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50/90 text-emerald-700 shadow-sm"
            aria-hidden
          >
            <CalendarDays className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="!mt-0 text-base font-semibold tracking-tight text-ink-900">
              Jours travaillés & TJM
            </CardTitle>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500 sm:text-xs">
              Coches = jours facturés · CA HT ≈ jours × {formatEur(tjmHt)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-5">
          {/* Calendrier + mois en cours : côte à côte dès sm */}
          <div className="flex w-full flex-col flex-wrap items-stretch gap-4 sm:flex-row sm:items-start sm:gap-4 lg:shrink-0">
          {/* Calendrier compact */}
          <div className="flex shrink-0 flex-col items-center sm:items-start">
            <div
              className="w-full max-w-[238px] rounded-2xl border border-ink-200/70 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.02] sm:p-3"
              role="group"
              aria-label={`Calendrier ${monthTitleFr(viewYear, viewMonth0)}`}
            >
              <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                </button>
                <div className="min-w-0 text-center">
                  <p className="truncate text-xs font-semibold capitalize leading-tight text-ink-900">
                    {monthTitleFr(viewYear, viewMonth0)}
                  </p>
                  <button
                    type="button"
                    onClick={goToday}
                    className="mt-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-800"
                  >
                    Aujourd’hui
                  </button>
                </div>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5">
                {WEEKDAYS_SHORT.map((w) => (
                  <div
                    key={w}
                    className="flex h-5 items-end justify-center pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400"
                  >
                    {w}
                  </div>
                ))}
                {matrix.map((cell, i) => {
                  if (!cell) {
                    return <div key={`e-${i}`} className="h-7 w-7 sm:h-7 sm:w-7" aria-hidden />;
                  }
                  const iso = toIso(viewYear, viewMonth0, cell.day);
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
                      className={clsx(
                        "relative flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                        on
                          ? clsx(
                              "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-900/15",
                              isHoliday &&
                                "ring-2 ring-amber-300/90 ring-offset-0 ring-offset-transparent",
                              !isHoliday &&
                                isSchoolVacation &&
                                "ring-2 ring-sky-300/90 ring-offset-0 ring-offset-transparent"
                            )
                          : clsx(
                              "text-ink-800 hover:bg-ink-100/90",
                              isHoliday &&
                                "bg-amber-50/95 font-semibold text-amber-900 ring-1 ring-amber-200/80 hover:bg-amber-100/95",
                              !isHoliday &&
                                isSchoolVacation &&
                                "bg-sky-50/95 font-medium text-sky-950 ring-1 ring-sky-200/75 hover:bg-sky-100/95",
                              !isHoliday && !isSchoolVacation && isWeekend && "text-ink-500",
                              isToday &&
                                "after:absolute after:bottom-0.5 after:left-1/2 after:h-0.5 after:w-3 after:-translate-x-1/2 after:rounded-full after:bg-brand-500",
                              isToday &&
                                !on &&
                                (isHoliday
                                  ? "font-semibold text-amber-900"
                                  : isSchoolVacation
                                    ? "font-semibold text-sky-900"
                                    : "font-semibold text-brand-700")
                            )
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={clearMonth}
              className="mt-2 max-w-[238px] text-center text-[10px] font-medium text-ink-500 transition hover:text-ink-800 sm:text-left"
            >
              Effacer ce mois
            </button>
            <div className="mt-1.5 max-w-[238px] space-y-1 text-center text-[9px] leading-snug text-ink-400 sm:text-left">
              <p className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm bg-amber-100 ring-1 ring-amber-200/80"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-ink-500">Fériés</span> (métrop.) — survol pour le nom.
                </span>
              </p>
              <p className="inline-flex items-start gap-1.5 text-left">
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-sm bg-sky-100 ring-1 ring-sky-200/80"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-ink-500">Vacances scolaires Paris</span> — calendrier officiel{" "}
                  <abbr title="Créteil, Montpellier, Paris, Toulouse, Versailles" className="no-underline">
                    zone&nbsp;C
                  </abbr>
                  . Survol d’un jour pour la période (Toussaint, Noël, hiver, printemps, été).
                </span>
              </p>
            </div>
          </div>

          {/* Mois sélectionné : brut TJM + IK — à droite du calendrier (sm+) */}
          <div className="min-w-0 w-full sm:max-w-sm sm:flex-1 lg:max-w-[300px]">
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-ink-200/80 bg-white p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Mois sélectionné
              </p>
              <p className="mt-1 text-[11px] leading-snug text-ink-600">
                {selectedViewMonthStats.isCurrent ? (
                  <>
                    Jusqu’au{" "}
                    <span className="font-medium text-ink-800">{selectedViewMonthStats.todayLongFr}</span>, vous
                    avez coché{" "}
                    <span className="font-semibold tabular-nums text-ink-900">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} travaillé
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""} (
                    <span className="capitalize">{selectedViewMonthStats.monthTitle}</span>).
                  </>
                ) : selectedViewMonthStats.isPast ? (
                  <>
                    Pour{" "}
                    <span className="font-medium capitalize text-ink-800">
                      {selectedViewMonthStats.monthTitle}
                    </span>
                    , vous avez coché{" "}
                    <span className="font-semibold tabular-nums text-ink-900">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} travaillé
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""}.
                  </>
                ) : (
                  <>
                    <span className="font-medium capitalize text-ink-800">
                      {selectedViewMonthStats.monthTitle}
                    </span>{" "}
                    :{" "}
                    <span className="font-semibold tabular-nums text-ink-900">
                      {selectedViewMonthStats.countedDays}
                    </span>{" "}
                    jour{selectedViewMonthStats.countedDays !== 1 ? "s" : ""} coché
                    {selectedViewMonthStats.countedDays !== 1 ? "s" : ""} sur ce mois (planification).
                  </>
                )}
              </p>

              <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
                <div>
                  <p className="text-[10px] font-medium text-ink-500">1) Brut type TJM (HT)</p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900">
                    {formatEur(brutTjmMoisEncoursHt)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-500">
                    {selectedViewMonthStats.countedDays} j. × {formatEur(tjmHt)} HT
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-ink-500">
                    2) Indemnité kilométrique aller-retour (estim.)
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-analyze-800">
                    {formatEur(ikMoisEncours)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-500">
                    {selectedViewMonthStats.countedDays} j. × {formatEur(ikPerDay)} (aller-retour / jour)
                  </p>
                  <BudgetGauge
                    label="Jauge IK"
                    valueEur={ikMoisEncours}
                    referenceEur={IK_REFERENCE_EUR}
                    tone="analyze"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-medium text-ink-500">
                    3) Frais de repas dirigeant et client
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900">
                    {formatEur(mealFeesForViewedMonth?.total ?? 0)}
                  </p>
                  {mealFeesForViewedMonth ? (
                    <p className="mt-0.5 text-[10px] text-ink-500">
                      dirigeant {formatEur(mealFeesForViewedMonth.dirigeant)} · client{" "}
                      {formatEur(mealFeesForViewedMonth.client)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      (nécessite les transactions du périmètre pour calculer)
                    </p>
                  )}
                  <BudgetGauge
                    label="Jauge repas"
                    valueEur={mealFeesForViewedMonth?.total ?? 0}
                    referenceEur={MEALS_REFERENCE_EUR}
                    tone="emerald"
                  />
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
            <div className="flex h-full flex-col justify-center rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 via-white to-analyze-50/30 p-3.5 sm:p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">
                Estimation CA HT
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-2">
                <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm">
                  <p className="text-[10px] font-medium text-ink-500">TJM / jour</p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900">
                    {formatEur(tjmHt)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm">
                  <p className="text-[10px] font-medium text-ink-500">
                    Mois · {countInMonth} j.
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-emerald-800">
                    {formatEur(revenueMonthHt)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100/90 bg-emerald-50/50 px-3 py-2.5 shadow-sm sm:col-span-1">
                  <p className="text-[10px] font-medium text-emerald-900/70">
                    Année {viewYear} · {countInYear} j.
                  </p>
                  <p className="mt-0.5 font-display text-base font-bold tabular-nums text-emerald-900">
                    {formatEur(revenueYearHt)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-ink-500">
                {persistToSupabase
                  ? "Données synchronisées avec votre compte (Supabase). Total année = jours cochés en "
                  : "Données enregistrées localement (mode démo ou lecture seule). Total année = jours cochés en "}
                {viewYear}.
              </p>
            </div>
          </div>
        </div>

        {treasuryTransactions != null && treasuryScope != null ? (
          <div className="mt-5 border-t border-ink-100/90 pt-5">
            <BillableInvoiceWorkedDaysChart data={invoiceWorkedDaysSeries} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
