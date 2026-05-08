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

