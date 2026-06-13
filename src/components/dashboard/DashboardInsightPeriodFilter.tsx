"use client";

import { clsx } from "clsx";
import { dashboardEyebrow, dashboardFilterPill, dashboardPanelTitle } from "@/lib/dashboard-surfaces";

function monthPillLabel(monthKey: string, withYear: boolean): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    ...(withYear ? { year: "numeric" } : {})
  }).format(new Date(y, m - 1, 1));
}

/** Filtre multi-mois / multi-années centré — partagé Valeur réelle & SASU. */
export function DashboardInsightPeriodFilter({
  eyebrow,
  title,
  yearOptions,
  monthOptions,
  selectedYears,
  selectedMonths,
  onToggleYear,
  onToggleMonth,
  onClearMonths
}: {
  eyebrow: string;
  title: string;
  yearOptions: number[];
  monthOptions: string[];
  selectedYears: number[];
  selectedMonths: string[];
  onToggleYear: (year: number) => void;
  onToggleMonth: (month: string) => void;
  onClearMonths: () => void;
}) {
  const yearSet = new Set(selectedYears);
  const monthSet = new Set(selectedMonths);
  const monthsForYears = monthOptions
    .filter((m) => yearSet.has(Number(m.slice(0, 4))))
    .sort((a, b) => a.localeCompare(b));
  const showYearOnPill = selectedYears.length > 1;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div>
        <p className={dashboardEyebrow}>{eyebrow}</p>
        <h2 className={clsx(dashboardPanelTitle, "mt-1")}>{title}</h2>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Années à inclure">
        {yearOptions.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={yearSet.has(y)}
            onClick={() => onToggleYear(y)}
            className={dashboardFilterPill(yearSet.has(y))}
          >
            {y}
          </button>
        ))}
      </div>

      {monthsForYears.length ? (
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Mois à inclure">
          <button
            type="button"
            aria-pressed={selectedMonths.length === 0}
            onClick={onClearMonths}
            className={dashboardFilterPill(selectedMonths.length === 0)}
          >
            {selectedYears.length > 1 ? "Toutes les années" : "Toute l'année"}
          </button>
          {monthsForYears.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={monthSet.has(m)}
              onClick={() => onToggleMonth(m)}
              className={clsx(dashboardFilterPill(monthSet.has(m)), "capitalize")}
            >
              {monthPillLabel(m, showYearOnPill)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
