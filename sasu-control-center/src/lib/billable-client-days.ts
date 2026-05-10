import { normalizeCounterpartyKey } from "@/lib/counterparty-logo";

/** TJM HT utilisé pour estimer les jours facturés (Skylab, Syrtals, etc.). */
export const BILLABLE_CLIENT_TJM_HT = 820;

/** Contreparties pour lesquelles on affiche « jours travaillés » à TJM fixe. */
export function isCounterpartyBillableDaysAtTjm(displayName: string): boolean {
  const k = normalizeCounterpartyKey(displayName);
  if (k.includes("syrtals")) return true;
  if (k === "skylab consulting" || (k.includes("skylab") && k.includes("consulting"))) return true;
  return false;
}

export function formatWorkedDaysFr(days: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(days);
}
