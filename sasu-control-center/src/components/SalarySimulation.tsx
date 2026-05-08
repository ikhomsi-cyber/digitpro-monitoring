"use client";

import { useMemo, useState } from "react";
import { formatEur } from "@/lib/format";
import { clsx } from "clsx";
import { saveSalarySimulation } from "@/app/dashboard/actions";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function SalarySimulation({
  cashAvailable,
  allowPersist = true
}: {
  cashAvailable: number;
  /** When false (demo / read-only), hide persistence to Supabase */
  allowPersist?: boolean;
}) {
  const [salary, setSalary] = useState<number>(2600);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "error">(null);

  // Intentionally simple "production-like" estimate, not an accounting tool.
  // Rough all-in cost factor to company (salary + employer contributions etc.).
  const estimatedCompanyCost = useMemo(() => Math.round(salary * 1.75), [salary]);
  const remainingCash = useMemo(
    () => Math.round(cashAvailable - estimatedCompanyCost),
    [cashAvailable, estimatedCompanyCost]
  );

  const remainingTone =
    remainingCash >= 0 ? "text-emerald-700" : "text-rose-700";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-slate-700">Salaire net souhaité</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="relative w-full">
            <input
              inputMode="numeric"
              value={salary}
              onChange={(e) => {
                const next = Number(String(e.target.value).replace(/[^\d]/g, ""));
                setSalary(clamp(Number.isFinite(next) ? next : 0, 0, 25000));
              }}
              className={clsx(
                "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none",
                "focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60"
              )}
              aria-label="Salaire net (EUR)"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
              €/mois
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Estimation simplifiée du coût entreprise (≈ 1,75×) pour une simulation rapide.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-medium text-slate-600">Coût total estimé</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {formatEur(estimatedCompanyCost)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-medium text-slate-600">Cash restant (estimé)</div>
          <div className={clsx("mt-1 text-lg font-semibold", remainingTone)}>
            {formatEur(remainingCash)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {allowPersist ? (
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                setSaved(null);
                try {
                  await saveSalarySimulation({
                    salaryNet: salary,
                    companyCostEstimate: estimatedCompanyCost,
                    cashAvailableAtTime: cashAvailable,
                    remainingCashEstimate: remainingCash
                  });
                  setSaved("ok");
                } catch {
                  setSaved("error");
                } finally {
                  setIsSaving(false);
                }
              }}
              className={clsx(
                "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50",
                isSaving && "opacity-60"
              )}
            >
              Enregistrer la simulation
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {saved === "ok" ? (
                <span className="font-medium text-emerald-700">Enregistrée</span>
              ) : saved === "error" ? (
                <span className="font-medium text-rose-700">Erreur</span>
              ) : (
                <span className="text-slate-500">Historique à venir</span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">Enregistrement désactivé en mode démo.</p>
        )}
      </div>
    </div>
  );
}

