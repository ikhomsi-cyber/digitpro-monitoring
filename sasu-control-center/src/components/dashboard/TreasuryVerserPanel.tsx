"use client";

import { useMemo } from "react";
import { Landmark, Scale } from "lucide-react";
import { formatEur } from "@/lib/format";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import {
  computeTreasuryVerserSnapshot,
  TREASURY_CSG_RATE,
  TREASURY_VAT_RATE
} from "@/lib/treasury-verser";

function monthTitleShortFr(y: number, month0: number): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(y, month0, 1)
  );
}

export function TreasuryVerserPanel({
  transactions,
  scope,
  viewYear,
  viewMonth0
}: {
  transactions: DashboardTx[];
  scope: "pro" | "personal";
  viewYear: number;
  viewMonth0: number;
}) {
  const snap = useMemo(
    () => computeTreasuryVerserSnapshot(transactions, scope, viewYear, viewMonth0),
    [transactions, scope, viewYear, viewMonth0]
  );

  const titleMonth = monthTitleShortFr(viewYear, viewMonth0);
  const csgPct = Math.round(TREASURY_CSG_RATE * 1000) / 10;
  const tvaPct = Math.round(TREASURY_VAT_RATE * 100);

  return (
    <div className="min-w-0 w-full sm:max-w-sm sm:flex-1 lg:max-w-[300px]">
      <div
        className="flex h-full min-h-0 flex-col rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/60 to-white p-3 shadow-sm ring-1 ring-black/[0.02] dark:border-violet-800/50 dark:from-violet-950/40 dark:to-ink-900/80 dark:shadow-none dark:ring-white/5 sm:p-3.5"
        data-private
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-200/70 bg-white text-violet-700 shadow-sm dark:border-violet-700/50 dark:bg-violet-950/50 dark:text-violet-300 dark:shadow-none"
            aria-hidden
          >
            <Scale className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/80 dark:text-violet-300/90">
              Disponible à verser (estim.)
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-600 dark:text-ink-300">
              Mois affiché : <span className="font-medium capitalize text-ink-800 dark:text-ink-100">{titleMonth}</span>
              <span className="text-ink-500 dark:text-ink-400">
                {" "}
                · périmètre {scope === "pro" ? "SASU" : "Privé"}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5 border-t border-violet-100/90 pt-3 text-[11px] leading-snug text-ink-600 dark:border-violet-900/40 dark:text-ink-300">
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">CA encaissé TTC</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900 dark:text-ink-50">
              {formatEur(snap.caEncaisseTtc)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">CA encaissé HT</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900 dark:text-ink-50">
              {formatEur(snap.caEncaisseHt)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">CSG ({csgPct} % HT)</span>
            <span className="shrink-0 font-semibold tabular-nums text-rose-800 dark:text-rose-300">
              {formatEur(snap.csgDue)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">TVA théorique ({tvaPct} % HT)</span>
            <span className="shrink-0 font-semibold tabular-nums text-rose-800 dark:text-rose-300">
              {formatEur(snap.tvaTheorique)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">IK (mois)</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-800 dark:text-ink-200">
              {formatEur(snap.ikMois)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">NDF (mois)</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-800 dark:text-ink-200">
              {formatEur(snap.ndfMois)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500 dark:text-ink-400">BNC (mois)</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-800 dark:text-ink-200">
              {formatEur(snap.bncMois)}
            </span>
          </div>
          <div className="flex justify-between gap-2 border-t border-violet-100/80 pt-2 dark:border-violet-900/40">
            <span className="font-medium text-ink-700 dark:text-ink-200">Versé ce mois</span>
            <span className="shrink-0 font-bold tabular-nums text-ink-900 dark:text-ink-50">
              {formatEur(snap.verseCeMois)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-ink-500 dark:text-ink-400">
              <Landmark className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              Solde Qonto (dernier connu)
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900 dark:text-ink-50">
              {snap.qontoSolde != null ? formatEur(snap.qontoSolde) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
