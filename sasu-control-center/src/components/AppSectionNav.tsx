"use client";

import { Suspense } from "react";
import { DashboardNavToasts } from "@/components/dashboard/DashboardNavToasts";

type StickyTopOffset = "dashboard" | "lmnp";

/** Raccourcis périmètre (pilules horizontales type app sports) + dock mobile séparé. */
export function AppSectionNav({
  offset: _offset,
  maxWidthClass: _maxWidthClass,
  className: _className
}: {
  offset?: StickyTopOffset;
  maxWidthClass?: string;
  className?: string;
}) {
  return (
    <Suspense fallback={null}>
      <DashboardNavToasts />
    </Suspense>
  );
}
