"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { CalendarRange } from "lucide-react";
import { DashboardPeriodFilterControls } from "@/components/dashboard/DashboardPeriodFilterControls";
import { formatDashboardPeriodLabel } from "@/lib/dashboard-period";

/** Bloc « Fenêtre d'analyse » (pilules + libellé vue active), identique SASU / Privé. */
export function DashboardPeriodFilterSection({
  selectedYears,
  setSelectedYears,
  yearOptions,
  onToggleYear
}: {
  selectedYears: number[] | null;
  setSelectedYears: Dispatch<SetStateAction<number[] | null>>;
  yearOptions: number[];
  onToggleYear: (y: number) => void;
}) {
  const periodLabel = useMemo(
    () => formatDashboardPeriodLabel(selectedYears),
    [selectedYears]
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          <CalendarRange className="h-4 w-4 text-ink-400" aria-hidden />
          Fenêtre d’analyse
        </span>
        <DashboardPeriodFilterControls
          selectedYears={selectedYears}
          setSelectedYears={setSelectedYears}
          yearOptions={yearOptions}
          onToggleYear={onToggleYear}
        />
      </div>
      <p className="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
        Vue active : <span className="font-medium text-ink-700 dark:text-ink-200">{periodLabel}</span>.
      </p>
    </div>
  );
}
