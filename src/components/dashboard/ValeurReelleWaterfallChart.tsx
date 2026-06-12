"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";
import {
  buildValeurReelleWaterfall,
  type ValeurReelleWaterfallStep
} from "@/lib/valeur-reelle-waterfall";
import { VALEUR_REELLE_WATERFALL_COLORS } from "@/components/dashboard/waterfall-axis-styles";
import { ValeurReelleWaterfallSvg } from "@/components/dashboard/ValeurReelleWaterfallSvg";

type Props = {
  tree: ValeurReelleCashTree;
  fmt: { euro: (n: number) => string };
};

function formatDelta(step: ValeurReelleWaterfallStep, formatEuro: Props["fmt"]["euro"]): string {
  if (step.deltaEur >= 0) return formatEuro(step.deltaEur);
  return `−${formatEuro(Math.abs(step.deltaEur))}`;
}

function WaterfallTooltip({
  step,
  fmt,
  onClose
}: {
  step: ValeurReelleWaterfallStep;
  fmt: Props["fmt"];
  onClose: () => void;
}) {
  const colors = VALEUR_REELLE_WATERFALL_COLORS[step.id] ?? VALEUR_REELLE_WATERFALL_COLORS.valeur_nette;
  const breakdown = step.breakdown?.filter((row) => Math.abs(row.amountEur) > 0) ?? [];

  return (
    <div
      className="rounded-2xl border border-ink-200/90 bg-white/95 px-3.5 py-3 text-xs shadow-lg backdrop-blur-sm dark:border-cyan-100/[0.14] dark:bg-[#0b3038]/95 dark:shadow-[0_20px_60px_-20px_rgba(0,22,28,0.85)]"
      role="tooltip"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colors.fill }}
              aria-hidden
            />
            <p className="font-bold text-ink-900 dark:text-white">{step.label}</p>
          </div>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-ink-950 dark:text-white">
            {formatDelta(step, fmt.euro)}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-ink-500 dark:text-white/45">
            {step.pctOfCaHt} % du CA HT
          </p>
          {step.kind === "total" || step.kind === "decrease" ? (
            <p className="mt-1 text-[10px] font-medium text-ink-500 dark:text-white/40">
              Solde après étape : {fmt.euro(step.cumulativeEur)}
            </p>
          ) : null}
          {step.detail ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500 dark:text-white/45">{step.detail}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:text-white/35 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
          aria-label="Fermer le détail"
        >
          ✕
        </button>
      </div>

      {breakdown.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-ink-100 pt-2 dark:border-white/[0.08]">
          {breakdown.slice(0, 8).map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-2 text-[10px] font-medium text-ink-600 dark:text-white/55"
            >
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums font-bold text-ink-800 dark:text-white/80">
                {fmt.euro(row.amountEur)}
              </span>
            </li>
          ))}
          {breakdown.length > 8 ? (
            <li className="text-[10px] text-ink-400 dark:text-white/35">
              + {breakdown.length - 8} autre{breakdown.length - 8 > 1 ? "s" : ""}…
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export function ValeurReelleWaterfallChart({ tree, fmt }: Props) {
  const model = useMemo(() => buildValeurReelleWaterfall(tree), [tree]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  const activeStep = activeStepId
    ? model.steps.find((step) => step.id === activeStepId) ?? null
    : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
          Waterfall financier
        </p>
        <p className="mt-0.5 text-[10px] font-medium text-ink-400 dark:text-white/35">
          CA HT → déductions → valeur nette
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <ValeurReelleWaterfallSvg
          steps={model.steps}
          formatDelta={(delta) =>
            delta >= 0 ? fmt.euro(delta) : `−${fmt.euro(Math.abs(delta))}`
          }
          ariaLabel="Waterfall financier Valeur réelle"
          activeStepId={activeStepId}
          onStepHover={setActiveStepId}
        />
      </div>

      {activeStep ? (
        <div className="mt-3">
          <WaterfallTooltip step={activeStep} fmt={fmt} onClose={() => setActiveStepId(null)} />
        </div>
      ) : (
        <p className="mt-2 text-[10px] font-medium text-ink-400 dark:text-white/35">
          Survolez une barre pour le détail et la ventilation par catégorie.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-200/40 pt-3 dark:border-cyan-100/[0.07]">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
          = Valeur nette
        </span>
        <div className="text-right">
          <span className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-white">
            {fmt.euro(model.valeurNetteEur)}
          </span>
          <span className="ml-2 text-[10px] font-semibold tabular-nums text-ink-500 dark:text-white/40">
            {model.caHtEur > 0
              ? `${Math.round((model.valeurNetteEur / model.caHtEur) * 1000) / 10} % du CA HT`
              : "—"}
          </span>
        </div>
      </div>

      <ol className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-ink-500 dark:text-white/45">
        {model.steps.map((step, index) => (
          <li key={`flow-${step.id}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span className="opacity-40">→</span> : null}
            <button
              type="button"
              onMouseEnter={() => setActiveStepId(step.id)}
              onFocus={() => setActiveStepId(step.id)}
              className={clsx(
                "rounded-full px-2 py-0.5 transition",
                step.kind === "total"
                  ? "bg-ink-100 text-ink-800 hover:bg-ink-200/80 dark:bg-white/[0.10] dark:text-white dark:hover:bg-white/[0.14]"
                  : "bg-ink-50 text-ink-600 hover:bg-ink-100 dark:bg-white/[0.06] dark:text-white/65 dark:hover:bg-white/[0.09]",
                activeStepId === step.id && "ring-1 ring-emerald-400/50"
              )}
            >
              {step.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
