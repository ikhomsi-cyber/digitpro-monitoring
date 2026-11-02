"use client";
import {PersonalPageSkeleton} from "./PersonalPageSkeleton";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GroceriesSection } from "./GroceriesSection";
import { useDashboardSection } from "./DashboardSectionContext";

/** Direct Courses entry avoids loading bank history and unrelated dashboard modules. */
export function CoursesEntry({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const { section } = useDashboardSection();
  useEffect(() => {
    if (section !== "courses") router.refresh();
  }, [section, router]);
  useEffect(() => {
    document.documentElement.dataset.digitproDashboardReady = "1";
    window.dispatchEvent(new Event("digitpro:dashboard-ready"));
  }, []);
  return section === "courses"
    ? <GroceriesSection demoMode={demoMode} />
    : <PersonalPageSkeleton kind={section==='invest'?'invest':'pilote'}/>;
}
