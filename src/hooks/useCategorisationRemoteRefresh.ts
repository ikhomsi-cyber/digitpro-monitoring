"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { CategorisationTx } from "@/app/categorisation/CategorisationClient";
import {
  CATEGORISATION_REFRESH_EVENT,
  type CategorisationRefreshDetail
} from "@/lib/categorisation-refresh-bus";

type RefreshResult = {
  transactions: CategorisationTx[];
  categories: string[];
  monthKey: string;
  newCount: number;
};

async function fetchCategorisationPayload(): Promise<RefreshResult> {
  const res = await fetch("/api/dashboard/categorisation", { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as null | {
    ok?: boolean;
    error?: string;
    transactions?: CategorisationTx[];
    categories?: string[];
    monthKey?: string;
  };
  if (!res.ok || !body?.ok || !body.transactions || !body.categories || !body.monthKey) {
    throw new Error(body?.error ?? "Impossible de rafraîchir les données.");
  }
  return {
    transactions: body.transactions,
    categories: body.categories,
    monthKey: body.monthKey,
    newCount: 0
  };
}

export function useCategorisationRemoteRefresh({
  transactions,
  setTransactions,
  setCategories,
  disabled = false
}: {
  transactions: readonly CategorisationTx[];
  setTransactions: Dispatch<SetStateAction<CategorisationTx[]>>;
  setCategories: Dispatch<SetStateAction<string[]>>;
  disabled?: boolean;
}) {
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const refreshFromApi = useCallback(
    async (detail?: CategorisationRefreshDetail) => {
      const previousIds = new Set(transactionsRef.current.map((tx) => tx.id));
      const payload = await fetchCategorisationPayload();
      const newCount = payload.transactions.filter((tx) => !previousIds.has(tx.id)).length;

      setTransactions(payload.transactions);
      setCategories(payload.categories);

      if (detail?.source === "pull") {
        if (newCount > 0) {
          toast.success(`${newCount} nouvelle${newCount > 1 ? "s" : ""} transaction${newCount > 1 ? "s" : ""}`);
        } else {
          toast.message("Liste à jour");
        }
        return payload;
      }

      const insertedHint = detail?.insertedCount ?? 0;
      if (newCount > 0 || insertedHint > 0) {
        const count = Math.max(newCount, insertedHint);
        toast.success(`${count} nouvelle${count > 1 ? "s" : ""} transaction${count > 1 ? "s" : ""}`, {
          description: "File de catégorisation mise à jour."
        });
      }

      return { ...payload, newCount };
    },
    [setCategories, setTransactions]
  );

  useEffect(() => {
    if (disabled) return;

    const onRefreshRequest = (event: Event) => {
      const detail = (event as CustomEvent<CategorisationRefreshDetail>).detail;
      void refreshFromApi(detail).catch((error) => {
        toast.error("Rafraîchissement impossible", {
          description: error instanceof Error ? error.message : undefined
        });
      });
    };

    window.addEventListener(CATEGORISATION_REFRESH_EVENT, onRefreshRequest);
    return () => window.removeEventListener(CATEGORISATION_REFRESH_EVENT, onRefreshRequest);
  }, [disabled, refreshFromApi]);

  return { refreshFromApi };
}
