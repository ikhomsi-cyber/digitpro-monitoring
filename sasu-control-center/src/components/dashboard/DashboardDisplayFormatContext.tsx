"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { eur, formatEurChartAxis, formatSignedEur } from "@/lib/format";
import { maskMoneyAmount, maskPercent0to100, maskPositiveInt } from "@/lib/dummy-display-numbers";

const DummyDataContext = createContext(false);

export function DashboardDummyDataProvider({
  active,
  children
}: {
  active: boolean;
  children: ReactNode;
}) {
  return <DummyDataContext.Provider value={active}>{children}</DummyDataContext.Provider>;
}

export function useDashboardDummyData(): boolean {
  return useContext(DummyDataContext);
}

/**
 * Formatters tenant compte du mode « données fictives » (cookie dashboard).
 * À utiliser sous `DashboardDummyDataProvider` (sinon `active` = false).
 */
export function useDashboardDisplayFormat() {
  const dummy = useDashboardDummyData();
  return useMemo(
    () => ({
      dummy,
      euro: (value: number) => eur.format(dummy ? maskMoneyAmount(value) : value),
      signedEuro: (value: number) => (dummy ? formatSignedEur(maskMoneyAmount(value)) : formatSignedEur(value)),
      chartAxisEuro: (value: number) =>
        formatEurChartAxis(dummy ? maskMoneyAmount(value) : value),
      /** Entiers positifs (jours cochés, « 12 mois », etc.). */
      int: (n: number) => (dummy ? maskPositiveInt(n) : Math.round(n)),
      /** Pourcentage 0–100 déjà arrondi pour affichage (ex. part d’une jauge). */
      percent0to100: (p: number) => (dummy ? maskPercent0to100(p) : Math.round(p))
    }),
    [dummy]
  );
}
