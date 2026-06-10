"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Applique un accent dark mode distinct (style Revolut) selon la section
 * active du dashboard. Met à jour l’attribut `data-page` du conteneur
 * `.premium-dashboard-page` parent, ciblé par `globals.css`.
 */
export function SectionThemeSync() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const panel = searchParams.get("panel");
    const section = searchParams.get("section");

    let page = "dashboard";
    if (panel === "valeur-reelle") page = "valeur";
    else if (panel === "lmnp") page = "lmnp";
    else if (section === "activite") page = "activite";
    else if (section === "sasu" || section === "private") page = "sasu";
    else if (section === "categorisation") page = "categorisation";

    const root = document.querySelector<HTMLElement>(".premium-dashboard-page");
    if (root) root.setAttribute("data-page", page);
  }, [searchParams]);

  return null;
}
