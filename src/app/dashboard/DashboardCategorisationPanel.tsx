"use client";

import { useEffect, useState } from "react";
import { CategorisationClient, type CategorisationTx } from "@/app/categorisation/CategorisationClient";
import { currentCategorisationMonthKey } from "@/lib/categorisation-candidates";
import { formatDashboardMonthLabel } from "@/lib/dashboard-period";

type ReadyState = {
  status: "ready";
  categories: string[];
  transactions: CategorisationTx[];
  monthKey: string;
  monthLabel: string;
  error: null;
};

type State =
  | { status: "loading"; categories: string[]; transactions: CategorisationTx[]; monthKey: string; monthLabel: string; error: null }
  | ReadyState
  | { status: "error"; categories: string[]; transactions: CategorisationTx[]; monthKey: string; monthLabel: string; error: string };

let cachedReadyState: ReadyState | null = null;

export function DashboardCategorisationPanel() {
  const [state, setState] = useState<State>(() =>
    cachedReadyState ?? {
      status: "loading",
      categories: [],
      transactions: [],
      monthKey: currentCategorisationMonthKey(),
      monthLabel: formatDashboardMonthLabel(currentCategorisationMonthKey()),
      error: null
    }
  );

  useEffect(() => {
    if (cachedReadyState) {
      setState(cachedReadyState);
      return;
    }

    let cancelled = false;
    void fetch("/api/dashboard/categorisation", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as null | {
          ok?: boolean;
          error?: string;
          categories?: string[];
          transactions?: CategorisationTx[];
          monthKey?: string;
        };
        if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Chargement impossible.");
        if (cancelled) return;
        const monthKey = body.monthKey ?? currentCategorisationMonthKey();
        const ready: ReadyState = {
          status: "ready",
          categories: body.categories ?? [],
          transactions: body.transactions ?? [],
          monthKey,
          monthLabel: formatDashboardMonthLabel(monthKey),
          error: null
        };
        cachedReadyState = ready;
        setState(ready);
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          categories: [],
          transactions: [],
          monthKey: currentCategorisationMonthKey(),
          monthLabel: formatDashboardMonthLabel(currentCategorisationMonthKey()),
          error: error instanceof Error ? error.message : "Chargement impossible."
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm font-medium text-white/55">
        Chargement de la catégorisation…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-800 dark:text-rose-200">
        {state.error}
      </div>
    );
  }

  if (state.categories.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-200/70 bg-white p-5 text-sm text-ink-700 shadow-card dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 dark:shadow-none">
        Aucune catégorie Bankin de référence trouvée. Importe d’abord un export Bankin pour construire la liste.
      </div>
    );
  }

  return (
    <CategorisationClient
      transactions={state.transactions}
      categories={state.categories}
      monthKey={state.monthKey}
      monthLabel={state.monthLabel}
    />
  );
}
