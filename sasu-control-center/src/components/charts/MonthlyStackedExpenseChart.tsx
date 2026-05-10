"use client";

import dynamic from "next/dynamic";

const MonthlyStackedExpenseChartClient = dynamic(
  () =>
    import("./MonthlyStackedExpenseChartClient").then((m) => m.MonthlyStackedExpenseChartClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-[304px] min-h-[288px] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    )
  }
);

export const MonthlyStackedExpenseChart = MonthlyStackedExpenseChartClient;
