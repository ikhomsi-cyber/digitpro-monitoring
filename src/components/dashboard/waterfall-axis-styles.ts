/** Classes axe X partagées — stylées dans globals.css (lisibles en dark mode). */
export const WATERFALL_AXIS_SVG_CLASS = "waterfall-axis-svg";

export const WATERFALL_AXIS_STYLES = {
  band: "waterfall-axis-band",
  baseline: "waterfall-axis-baseline",
  connectorLine: "waterfall-axis-connector-line",
  connector: "waterfall-axis-connector",
  label: "waterfall-axis-label",
  value: "waterfall-axis-value",
  pct: "waterfall-axis-pct"
} as const;

/** Palette & géométrie — identiques mini + waterfall financier. */
export const VALEUR_REELLE_WATERFALL_COLORS: Record<string, { fill: string; stroke: string }> = {
  ca_ht: { fill: "#34d399", stroke: "#10b981" },
  revenue: { fill: "#34d399", stroke: "#10b981" },
  csg: { fill: "#fb923c", stroke: "#f97316" },
  digitpro: { fill: "#fb7185", stroke: "#f43f5e" },
  business: { fill: "#fb7185", stroke: "#f43f5e" },
  personal: { fill: "#2dd4bf", stroke: "#14b8a6" },
  valeur_nette: { fill: "#38bdf8", stroke: "#0ea5e9" },
  retained: { fill: "#38bdf8", stroke: "#0ea5e9" }
};

export const WATERFALL_AXIS_LAYOUT = {
  labelAreaH: 58,
  labelY: 18,
  valueY: 34,
  pctY: 48,
  label: { fontSize: 12, fontWeight: 600 },
  value: { fontSize: 13, fontWeight: 700 },
  pct: { fontSize: 11, fontWeight: 600 }
} as const;

export const WATERFALL_CHART_LAYOUT = {
  chartW: 560,
  chartH: 176,
  gap: 10,
  barRx: 6,
  barStrokeWidth: 1.2,
  connectorDash: "4 3",
  minWidth: "min-w-[340px]"
} as const;
