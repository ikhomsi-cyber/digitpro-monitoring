import "server-only";

import { fetchQontoBankAccountBalanceEur, isQontoApiConfigured } from "@/lib/qonto/sync";

const QONTO_LIVE_BALANCE_TIMEOUT_MS = 8_000;

/** Solde live Qonto ; `null` si API non configurée, en échec, ou solde absent. */
export async function loadQontoLiveBalanceEur(): Promise<number | null> {
  if (!isQontoApiConfigured()) return null;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("[qonto] live balance timed out; using imported balance.");
      resolve(null);
    }, QONTO_LIVE_BALANCE_TIMEOUT_MS);

    void fetchQontoBankAccountBalanceEur()
      .then((balance) => {
        clearTimeout(timeout);
        resolve(balance);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.warn("[qonto] live balance unavailable:", error);
        resolve(null);
      });
  });
}
