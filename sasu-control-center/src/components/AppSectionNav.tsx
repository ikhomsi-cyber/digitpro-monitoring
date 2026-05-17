"use client";

import { Suspense } from "react";
import { DashboardNavToasts } from "@/components/dashboard/DashboardNavToasts";

/** Raccourcis périmètre (pilules horizontales type app sports) + dock mobile séparé. */
export function AppSectionNav() {
  return (
    <Suspense fallback={null}>
      <DashboardNavToasts />
    </Suspense>
  );
}
