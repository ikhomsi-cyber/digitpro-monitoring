/** Fonctions de présentation pures partagées par les visualisations du dashboard. */

export function sumDashboardValues(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function formatDashboardMonthShort(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const date = new Date(Date.UTC(year || 2000, (month || 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(date);
}

export function formatCompactEuroAxis(value: number): string {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1_000_000) return `${Math.round(value / 100_000) / 10}M€`;
  if (absoluteValue >= 10_000) return `${Math.round(value / 1000)}k€`;
  if (absoluteValue >= 1000) return `${Math.round(value / 100) / 10}k€`;
  return `${Math.round(value)}€`;
}

export type DashboardSvgPoint = { x: number; y: number };

export function smoothDashboardSvgPath(points: readonly DashboardSvgPoint[]): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;

  let path = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

/** Mois civil courant en heure locale, compatible avec les dates YYYY-MM-DD. */
export function currentDashboardMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
