"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { loadHiwayInvoices } from "@/app/dashboard/gmail-actions";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";

export type HiwayInvoicesContextValue = {
  /** null tant que le premier chargement n'a pas eu lieu (ou en mode démo). */
  invoices: HiwayInvoice[] | null;
  setInvoices: (next: HiwayInvoice[] | null) => void;
  /** Recharge depuis Supabase (factures déjà stockées). */
  reload: () => void;
  loading: boolean;
};

const HiwayInvoicesContext = createContext<HiwayInvoicesContextValue | null>(null);

/**
 * État partagé des factures Hiway, possédé par le propriétaire (DashboardClient)
 * pour pouvoir dériver le CSG additionnel tout en partageant la même source au
 * graphique « Jours facturés » et au bloc « Factures émises ».
 */
export function useHiwayInvoicesState(enabled: boolean): HiwayInvoicesContextValue {
  const [invoices, setInvoices] = useState<HiwayInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(() => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    void loadHiwayInvoices()
      .then(({ invoices: rows }) => {
        if (requestId !== requestIdRef.current) return;
        // null = pas (encore) de factures stockées → conserve l'invite « Récupérer ».
        setInvoices(rows.length > 0 ? rows : null);
      })
      .catch(() => {
        // Table non migrée, non connecté ou mode démo : on laisse l'état tel quel.
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return useMemo<HiwayInvoicesContextValue>(
    () => ({ invoices, setInvoices, reload, loading }),
    [invoices, reload, loading]
  );
}

export function HiwayInvoicesProvider({
  value,
  children
}: {
  value: HiwayInvoicesContextValue;
  children: ReactNode;
}) {
  return (
    <HiwayInvoicesContext.Provider value={value}>{children}</HiwayInvoicesContext.Provider>
  );
}

export function useHiwayInvoices(): HiwayInvoicesContextValue {
  const ctx = useContext(HiwayInvoicesContext);
  if (!ctx) {
    throw new Error("useHiwayInvoices must be used within HiwayInvoicesProvider");
  }
  return ctx;
}

export function useHiwayInvoicesOptional(): HiwayInvoicesContextValue | null {
  return useContext(HiwayInvoicesContext);
}
