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
        className="flex h-full min-h-0 flex-col rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/60 to-white p-3 shadow-sm ring-1 ring-black/[0.02] sm:p-3.5"
        data-private
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-200/70 bg-white text-violet-700 shadow-sm"
            aria-hidden
          >
            <Scale className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-800/80">
              Disponible à verser (estim.)
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-600">
              Mois affiché : <span className="font-medium capitalize text-ink-800">{titleMonth}</span>
              <span className="text-ink-500">
                {" "}
                · périmètre {scope === "pro" ? "SASU" : "Privé"}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5 border-t border-violet-100/90 pt-3 text-[11px] leading-snug text-ink-600">
          <div className="flex justify-between gap-2">
            <span className="text-ink-500">CA encaissé TTC</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900">
              {formatEur(snap.caEncaisseTtc)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500">CA encaissé HT</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900">
              {formatEur(snap.caEncaisseHt)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500">CSG ({csgPct} % HT)</span>
            <span className="shrink-0 font-semibold tabular-nums text-rose-800">
              {formatEur(snap.csgDue)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500">TVA théorique ({tvaPct} % HT)</span>
            <span className="shrink-0 font-semibold tabular-nums text-rose-800">
              {formatEur(snap.tvaTheorique)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-500">TVA prélevée (mois)</span>
            <span className="shrink-0 font-semibold tabular-nums text-emerald-800">
              − {formatEur(snap.tvaPrelevee)}
            </span>
          </div>
          <div className="flex justify-between gap-2 border-t border-violet-100/80 pt-2">
            <span className="font-medium text-ink-700">Provisions nettes</span>
            <span className="shrink-0 font-bold tabular-nums text-ink-900">
              {formatEur(snap.provisionsFiscalesNet)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-ink-500">
              <Landmark className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              Solde Qonto (dernier connu)
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900">
              {snap.qontoSolde != null ? formatEur(snap.qontoSolde) : "—"}
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-violet-200/90 bg-white/90 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-violet-800/70">
            Écart (solde − provisions)
          </p>
          <p
            className={`mt-1 font-display text-lg font-bold tabular-nums ${
              snap.disponibleAVerser == null
                ? "text-ink-400"
                : snap.disponibleAVerser >= 0
                  ? "text-emerald-800"
                  : "text-rose-800"
            }`}
          >
            {snap.disponibleAVerser != null ? formatEur(snap.disponibleAVerser) : "—"}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500">
            Indicatif : même règle de date CA que le tableau de bord (fin de mois → mois suivant). TVA
            prélevée = opérations du mois civil classées TVA. Sans colonne Solde sur les mouvements, le
            solde n’apparaît pas.
          </p>
        </div>
      </div>
    </div>
  );
}
