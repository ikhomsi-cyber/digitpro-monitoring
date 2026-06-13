"use client";

import { useEffect } from "react";
import { useDashboardSection } from "@/components/dashboard/DashboardSectionContext";

/**
 * Synchronise `data-page` sur le conteneur dashboard (toutes les sections
 * partagent le même fond teal défini dans `globals.css`).
 */
export function SectionThemeSync() {
  const { section } = useDashboardSection();

  useEffect(() => {
    let page = "dashboard";
    if (section === "valeur") page = "valeur";
    else if (section === "activite") page = "activite";
    else if (section === "sasu" || section === "private") page = "sasu";
    else if (section === "categorisation") page = "categorisation";

    const root = document.querySelector<HTMLElement>(".premium-dashboard-page");
    if (root) root.setAttribute("data-page", page);
  }, [section]);

  return null;
}
