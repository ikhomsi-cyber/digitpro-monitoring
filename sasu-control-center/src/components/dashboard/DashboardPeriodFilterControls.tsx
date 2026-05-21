"use client";

import type { Dispatch, SetStateAction } from "react";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { clsx } from "clsx";
import { formatDashboardMonthLabel } from "@/lib/dashboard-period";

/** 12 mois glissants vs années civiles — même logique que la section analytics SASU. */
export function DashboardPeriodFilterControls({
  selectedYears,
  setSelectedYears,
  selectedMonth = null,
  setSelectedMonth,
  monthOptions = [],
  yearOptions,
  onToggleYear
}: {
  selectedYears: number[] | null;
  setSelectedYears: Dispatch<SetStateAction<number[] | null>>;
  selectedMonth?: string | null;
  setSelectedMonth?: Dispatch<SetStateAction<string | null>>;
  monthOptions?: string[];
  yearOptions: number[];
  onToggleYear: (y: number) => void;
}) {
  const monthModeActive = Boolean(selectedMonth);
  const availableMonthOptions =
    selectedYears != null && selectedYears.length > 0
      ? monthOptions.filter((month) => selectedYears.includes(Number(month.slice(0, 4))))
      : monthOptions.slice(0, 12);
  const activeMonthStillAvailable = selectedMonth
    ? availableMonthOptions.includes(selectedMonth)
    : true;

  return (
    <div className="inline-flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="inline-flex max-w-full rounded-full border border-ink-300 bg-ink-50/80 p-1 dark:border-ink-700 dark:bg-ink-950/80">
        <button
          type="button"
          aria-pressed={selectedYears === null && !monthModeActive}
          onClick={() => {
            setSelectedMonth?.(null);
            setSelectedYears(null);
          }}
          className={clsx(
            "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial sm:px-4",
            selectedYears === null && !monthModeActive
              ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
              : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
          )}
        >
          <CalendarRange className="h-3.5 w-3.5 opacity-80" aria-hidden />
          12 mois glissants
        </button>
        <button
          type="button"
          aria-pressed={selectedYears !== null && !monthModeActive}
          onClick={() => {
            setSelectedMonth?.(null);
            setSelectedYears((prev) => prev ?? [yearOptions[0] ?? new Date().getFullYear()]);
          }}
          className={clsx(
            "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial sm:px-4",
            selectedYears !== null && !monthModeActive
              ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
              : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
          )}
        >
          <Calendar className="h-3.5 w-3.5 opacity-80" aria-hidden />
          Année(s) civile(s)
        </button>
        {setSelectedMonth ? (
          <button
            type="button"
            aria-pressed={monthModeActive}
            onClick={() => {
              setSelectedYears((prev) => prev ?? null);
              setSelectedMonth((prev) =>
                prev && availableMonthOptions.includes(prev)
                  ? prev
                  : availableMonthOptions[0] ?? new Date().toISOString().slice(0, 7)
              );
            }}
            className={clsx(
              "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 sm:flex-initial sm:px-4",
              monthModeActive
                ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50 dark:shadow-none"
                : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 opacity-80" aria-hidden />
            Mois
          </button>
        ) : null}
      </div>
      {monthModeActive && setSelectedMonth ? (
        <div
          className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:pl-1"
          role="group"
          aria-label="Sélection du mois à afficher"
        >
          <span className="shrink-0 text-xs font-medium text-ink-500 dark:text-ink-400">Mois :</span>
          {!activeMonthStillAvailable ? (
            <button
              type="button"
              onClick={() => setSelectedMonth(availableMonthOptions[0] ?? null)}
              className="min-h-[40px] shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100 sm:min-h-0 sm:py-1"
            >
              Revenir à la période
            </button>
          ) : null}
          {availableMonthOptions.map((month) => {
            const on = selectedMonth === month;
            return (
              <button
                key={month}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedMonth(month)}
                className={clsx(
                  "min-h-[40px] shrink-0 rounded-full border px-3 py-2 text-xs font-semibold capitalize tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:min-h-0 sm:py-1",
                  on
                    ? "border-brand-500 bg-brand-50 text-brand-900 shadow-sm dark:border-brand-400 dark:bg-brand-900/60 dark:text-white dark:shadow-brand-950/40"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-ink-600"
                )}
              >
                {formatDashboardMonthLabel(month)}
              </button>
            );
          })}
        </div>
      ) : selectedYears != null && !monthModeActive ? (
        <div
          className="flex max-w-full flex-wrap items-center gap-2 sm:pl-1"
          role="group"
          aria-label="Sélection des années à inclure"
        >
          <span className="text-xs font-medium text-ink-500 dark:text-ink-400">Inclure :</span>
          {yearOptions.map((y) => {
            const on = selectedYears.includes(y);
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleYear(y)}
                className={clsx(
                  "min-h-[40px] rounded-full border px-3 py-2 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-ink-950 sm:min-h-0 sm:py-1",
                  on
                    ? "border-brand-500 bg-brand-50 text-brand-900 shadow-sm dark:border-brand-400 dark:bg-brand-900/60 dark:text-white dark:shadow-brand-950/40"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-ink-600"
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
