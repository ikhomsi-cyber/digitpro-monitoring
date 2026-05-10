export const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

export function formatEur(value: number) {
  return eur.format(value);
}

export function formatSignedEur(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatEur(Math.abs(value))}`;
}

/** Axe Y des graphiques : compact au-delà de ~1 k€, sinon montant entier. */
const eurAxisCompact = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1
});

export function formatEurChartAxis(value: number) {
  if (!Number.isFinite(value)) return "";
  const a = Math.abs(value);
  if (a > 0 && a < 1000) return eur.format(value);
  return eurAxisCompact.format(value);
}

