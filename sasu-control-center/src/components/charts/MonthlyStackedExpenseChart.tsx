"use client";

import dynamic from "next/dynamic";

const MonthlyStackedExpenseChartClient = dynamic(
  () =>
    import("./MonthlyStackedExpenseChartClient").then((m) => m.MonthlyStackedExpenseChartClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    )
  }
);

export const MonthlyStackedExpenseChart = MonthlyStackedExpenseChartClient;
