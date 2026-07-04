"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { syncQontoTransactionsFromApi } from "@/app/dashboard/actions";
import { requestCategorisationRefresh } from "@/lib/categorisation-refresh-bus";

export function useDashboardRemoteRefresh({
  refreshDashboardTransactions,
  demoMode = false
}: {
  refreshDashboardTransactions: () => Promise<boolean>;
  demoMode?: boolean;
}) {
  const refreshWithQontoSync = useCallback(
    async (source: "pull" | "manual" = "manual") => {
      let insertedFromSync = 0;

      if (!demoMode) {
        if (source === "pull") {
          try {
            const result = await syncQontoTransactionsFromApi();
            insertedFromSync = result.inserted;
            if (insertedFromSync > 0) {
              requestCategorisationRefresh({ source: "qonto", insertedCount: insertedFromSync });
            }
          } catch (error) {
            toast.warning("Synchro Qonto impossible", {
              description: error instanceof Error ? error.message : undefined
            });
          }
        }
      } else if (source === "pull") {
        toast.message("Mode démo", { description: "Synchronisation Qonto désactivée." });
      }

      const refreshed = await refreshDashboardTransactions();

      if (source === "pull") {
        if (insertedFromSync > 0) {
          toast.success(
            `${insertedFromSync} transaction${insertedFromSync > 1 ? "s" : ""} importée${insertedFromSync > 1 ? "s" : ""} depuis Qonto`,
            {
              description: refreshed
                ? "Dashboard mis à jour."
                : "Import OK, mais le rechargement a échoué."
            }
          );
        } else if (refreshed) {
          toast.message("Données à jour", {
            description: "Aucune nouvelle transaction Qonto."
          });
        } else {
          toast.error("Rafraîchissement impossible");
        }
      }

      return { refreshed, insertedFromSync };
    },
    [demoMode, refreshDashboardTransactions]
  );

  return { refreshWithQontoSync };
}
