import { normalizeCounterpartyKey } from "@/lib/counterparty-logo";

/** TJM HT utilisé pour estimer les jours facturés (Skylab, Syrtals, etc.). */
export const BILLABLE_CLIENT_TJM_HT = 820;

export type BillableRatePeriod = {
  clientName: string;
  startDate: string;
  endDate: string | null;
  tjmHt: number;
};

function normalizeClientName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseMonthStart(monthKey: string): string {
  return `${monthKey.slice(0, 7)}-01`;
}

export function resolveBillableTjmForClientMonth(
  periods: readonly BillableRatePeriod[],
  clientName: string | null | undefined,
  monthKey: string,
  fallbackTjmHt = BILLABLE_CLIENT_TJM_HT
): number {
  const fallback = Number.isFinite(fallbackTjmHt) && fallbackTjmHt > 0 ? fallbackTjmHt : BILLABLE_CLIENT_TJM_HT;
  const client = normalizeClientName(clientName ?? "");
  const monthStart = parseMonthStart(monthKey);
  const matches = periods
    .filter((period) => {
      const tjm = Number(period.tjmHt);
      if (!Number.isFinite(tjm) || tjm <= 0) return false;
      if (period.startDate > monthStart) return false;
      if (period.endDate && period.endDate < monthStart) return false;
      const periodClient = normalizeClientName(period.clientName);
      if (!periodClient) return false;
      return client.includes(periodClient) || periodClient.includes(client);
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return matches[0]?.tjmHt ?? fallback;
}

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
