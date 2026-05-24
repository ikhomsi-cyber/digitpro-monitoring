"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { CalendarRange } from "lucide-react";
import { clsx } from "clsx";
import { DashboardPeriodFilterControls } from "@/components/dashboard/DashboardPeriodFilterControls";
import { formatDashboardPeriodLabelWithMonth } from "@/lib/dashboard-period";

/** Bloc « Fenêtre d'analyse » (pilules + libellé vue active), identique SASU / Privé. */
export function DashboardPeriodFilterSection({
  selectedYears,
  setSelectedYears,
  selectedMonth = null,
  setSelectedMonth,
  monthOptions = [],
  yearOptions,
  onToggleYear,
  sticky = false,
  showRollingOption = true,
  showActiveLabel = true
}: {
  selectedYears: number[] | null;
  setSelectedYears: Dispatch<SetStateAction<number[] | null>>;
  selectedMonth?: string | null;
  setSelectedMonth?: Dispatch<SetStateAction<string | null>>;
  monthOptions?: string[];
  yearOptions: number[];
  onToggleYear: (y: number) => void;
  sticky?: boolean;
  showRollingOption?: boolean;
  showActiveLabel?: boolean;
}) {
  const periodLabel = useMemo(
    () => formatDashboardPeriodLabelWithMonth(selectedYears, selectedMonth),
    [selectedYears, selectedMonth]
  );

  return (
    <div
      className={clsx(
        "flex min-w-0 flex-col gap-3 transition-[padding,background-color,border-color,box-shadow] duration-200",
        sticky &&
          "sticky top-[calc(env(safe-area-inset-top)+0.25rem)] z-20"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <CalendarRange className="h-4 w-4 text-ink-400" aria-hidden />
          Fenêtre d’analyse
        </span>
        <DashboardPeriodFilterControls
          selectedYears={selectedYears}
          setSelectedYears={setSelectedYears}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          monthOptions={monthOptions}
          yearOptions={yearOptions}
          onToggleYear={onToggleYear}
          showRollingOption={showRollingOption}
        />
      </div>
      {showActiveLabel ? (
      <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        Vue active : <span className="font-medium text-ink-700 dark:text-ink-200">{periodLabel}</span>.
      </p>
      ) : null}
    </div>
  );
}
