"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { eur, formatEurChartAxis, formatSignedEur } from "@/lib/format";
import { maskMoneyAmount, maskPercent0to100, maskPositiveInt } from "@/lib/dummy-display-numbers";
import { DASHBOARD_DUMMY_DATA_COOKIE } from "@/lib/dashboard-dummy-data-preference";

type DummyDataContextValue = {
  active: boolean;
  setActive: (next: boolean) => void;
  toggle: () => void;
};

const DummyDataContext = createContext<DummyDataContextValue>({
  active: false,
  setActive: () => {},
  toggle: () => {}
});

/**
 * Persiste la préférence dans un cookie **lisible côté serveur** (non httpOnly) afin que le
 * SSR initial reflète le bon état au rechargement, sans aucun aller-retour serveur au clic.
 */
function persistDummyDataCookie(active: boolean) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (active) {
    document.cookie = `${DASHBOARD_DUMMY_DATA_COOKIE}=1; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${DASHBOARD_DUMMY_DATA_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
}

export function DashboardDummyDataProvider({
  active,
  children
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [isActive, setIsActive] = useState(active);

  const setActive = useCallback((next: boolean) => {
    setIsActive(next);
    persistDummyDataCookie(next);
  }, []);

  const toggle = useCallback(() => {
    setIsActive((prev) => {
      const next = !prev;
      persistDummyDataCookie(next);
      return next;
    });
  }, []);

  const value = useMemo<DummyDataContextValue>(
    () => ({ active: isActive, setActive, toggle }),
    [isActive, setActive, toggle]
  );

  return <DummyDataContext.Provider value={value}>{children}</DummyDataContext.Provider>;
}

export function useDashboardDummyData(): boolean {
  return useContext(DummyDataContext).active;
}

/** Contrôle le mode « données fictives » côté client (instantané, sans appel serveur/BDD). */
export function useDashboardDummyDataControls() {
  const { active, setActive, toggle } = useContext(DummyDataContext);
  return { active, setActive, toggle };
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
