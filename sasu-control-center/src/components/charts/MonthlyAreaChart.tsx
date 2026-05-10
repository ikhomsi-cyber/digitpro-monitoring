"use client";

import dynamic from "next/dynamic";

const MonthlyAreaChartClient = dynamic(
  () => import("./MonthlyAreaChartClient").then((m) => m.MonthlyAreaChartClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-[288px] min-h-[288px] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    )
  }
);

export const MonthlyAreaChart = MonthlyAreaChartClient;

