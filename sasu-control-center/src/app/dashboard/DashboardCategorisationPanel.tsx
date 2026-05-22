"use client";

import { useEffect, useState } from "react";
import { CategorisationClient, type CategorisationTx } from "@/app/categorisation/CategorisationClient";

type State =
  | { status: "loading"; categories: string[]; transactions: CategorisationTx[]; error: null }
  | { status: "ready"; categories: string[]; transactions: CategorisationTx[]; error: null }
  | { status: "error"; categories: string[]; transactions: CategorisationTx[]; error: string };

export function DashboardCategorisationPanel() {
  const [state, setState] = useState<State>({
    status: "loading",
    categories: [],
    transactions: [],
    error: null
  });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/dashboard/categorisation", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as null | {
          ok?: boolean;
          error?: string;
          categories?: string[];
          transactions?: CategorisationTx[];
        };
        if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Chargement impossible.");
        if (cancelled) return;
        setState({
          status: "ready",
          categories: body.categories ?? [],
          transactions: body.transactions ?? [],
          error: null
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          categories: [],
          transactions: [],
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
      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-900 dark:text-amber-100">
        Aucune catégorie Bankin de référence trouvée. Importe d&apos;abord un export Bankin pour construire la liste.
      </div>
    );
  }

  return <CategorisationClient transactions={state.transactions} categories={state.categories} />;
}
