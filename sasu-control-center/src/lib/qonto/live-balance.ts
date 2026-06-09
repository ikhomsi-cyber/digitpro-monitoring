import "server-only";

import { fetchQontoBankAccountBalanceEur, isQontoApiConfigured } from "@/lib/qonto/sync";

/** Solde live Qonto ; `null` si API non configurée, en échec, ou solde absent. */
export async function loadQontoLiveBalanceEur(): Promise<number | null> {
  if (!isQontoApiConfigured()) return null;
  try {
    return await fetchQontoBankAccountBalanceEur();
  } catch (error) {
    console.warn("[qonto] live balance unavailable:", error);
    return null;
  }
}
