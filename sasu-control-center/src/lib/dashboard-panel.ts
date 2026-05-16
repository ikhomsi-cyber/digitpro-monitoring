export type DashboardPanelParam = "lmnp" | "valeur-reelle" | null;

export function parseDashboardPanelParam(
  sp: Record<string, string | string[] | undefined> | undefined
): DashboardPanelParam {
  if (!sp) return null;
  const raw = sp.panel;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "lmnp") return "lmnp";
  if (v === "valeur-reelle") return "valeur-reelle";
  return null;
}

/** Panneaux plein écran qui remplacent le hero + DashboardClient. */
export function isDashboardAnalyticsPanel(panel: string | null): boolean {
  return panel === "lmnp" || panel === "valeur-reelle";
}
