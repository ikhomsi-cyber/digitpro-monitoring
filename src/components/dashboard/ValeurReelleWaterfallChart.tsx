"use client";

import { useMemo, useState } from "react";
import { Waves } from "lucide-react";
import { clsx } from "clsx";
import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";
import {
  buildValeurReelleWaterfall,
  valeurReelleWaterfallBarGeometry,
  type ValeurReelleWaterfallStep
} from "@/lib/valeur-reelle-waterfall";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";
import {
  WATERFALL_AXIS_STYLES,
  WATERFALL_AXIS_SVG_CLASS
} from "@/components/dashboard/waterfall-axis-styles";

/** Typo axe X — alignée sur MiniWaterfallSvg (ValeurReelleDailyValueCard) */
const WATERFALL_AXIS = {
  labelAreaH: 58,
  labelY: 18,
  valueY: 34,
  pctY: 48,
  label: { fontSize: 12, fontWeight: 600 },
  value: { fontSize: 13, fontWeight: 700 },
  pct: { fontSize: 11, fontWeight: 600 }
} as const;

const STEP_COLORS: Record<string, { fill: string; stroke: string }> = {
  ca_ht: { fill: "#34d399", stroke: "#10b981" },
  csg: { fill: "#fb923c", stroke: "#f97316" },
  digitpro: { fill: "#fb7185", stroke: "#f43f5e" },
  personal: { fill: "#2dd4bf", stroke: "#14b8a6" },
  valeur_nette: { fill: "#38bdf8", stroke: "#0ea5e9" }
};

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
  const colors = STEP_COLORS[step.id] ?? STEP_COLORS.valeur_nette;
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

  const maxValue = useMemo(
    () => Math.max(1, model.steps[0]?.cumulativeEur ?? 1),
    [model.steps]
  );

  const chartW = 560;
  const chartH = 176;
  const gap = 10;
  const barW = (chartW - gap * (model.steps.length + 1)) / model.steps.length;

  const geometries = useMemo(
    () =>
      model.steps.map((step, index) => {
        const prevCumulative = index === 0 ? 0 : (model.steps[index - 1]?.cumulativeEur ?? 0);
        return {
          step,
          geom: valeurReelleWaterfallBarGeometry(
            step,
            prevCumulative,
            index,
            maxValue,
            chartW,
            chartH,
            gap,
            barW
          ),
          prevCumulative
        };
      }),
    [model.steps, maxValue, barW]
  );

  const activeStep = activeStepId
    ? model.steps.find((step) => step.id === activeStepId) ?? null
    : null;

  return (
    <div className="mb-4 rounded-2xl border border-ink-200/80 bg-white/75 px-4 py-4 shadow-sm dark:border-cyan-100/[0.10] dark:bg-cyan-50/[0.055] dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 dark:text-white/45">
            Waterfall financier
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-ink-400 dark:text-white/35">
            CA HT → déductions → valeur nette
          </p>
        </div>
        <PremiumIconBadge icon={Waves} tone="sky" size="md" />
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${chartH + WATERFALL_AXIS.labelAreaH}`}
          className={clsx("w-full min-w-[340px]", WATERFALL_AXIS_SVG_CLASS)}
          role="img"
          aria-label="Waterfall financier Valeur réelle"
        >
          <rect
            x={0}
            y={chartH + 1}
            width={chartW}
            height={WATERFALL_AXIS.labelAreaH - 1}
            rx="6"
            className={WATERFALL_AXIS_STYLES.band}
            aria-hidden
          />
          <line
            x1={gap}
            x2={chartW - gap}
            y1={chartH}
            y2={chartH}
            className={WATERFALL_AXIS_STYLES.baseline}
            strokeWidth="1"
          />
          {geometries.map(({ step, geom }, index) => {
            const colors = STEP_COLORS[step.id] ?? STEP_COLORS.valeur_nette;
            const prevGeom = index > 0 ? geometries[index - 1] : null;
            const connectorY =
              index > 0 && step.kind === "decrease"
                ? chartH - (geometries[index - 1].prevCumulative / maxValue) * chartH
                : null;
            const isActive = activeStepId === step.id;

            return (
              <g key={step.id}>
                {connectorY != null ? (
                  <line
                    x1={(prevGeom?.geom.x ?? 0) + (prevGeom?.geom.width ?? 0)}
                    x2={geom.x + geom.width / 2}
                    y1={connectorY}
                    y2={connectorY}
                    className={WATERFALL_AXIS_STYLES.connectorLine}
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                ) : null}
                <rect
                  x={geom.x - 2}
                  y={geom.y - 4}
                  width={geom.width + 4}
                  height={geom.height + 8}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveStepId(step.id)}
                  onFocus={() => setActiveStepId(step.id)}
                  onMouseLeave={() => setActiveStepId((id) => (id === step.id ? null : id))}
                  onBlur={() => setActiveStepId((id) => (id === step.id ? null : id))}
                  tabIndex={0}
                  aria-label={`${step.label} ${formatDelta(step, fmt.euro)}`}
                />
                <rect
                  x={geom.x}
                  y={geom.y}
                  width={geom.width}
                  height={geom.height}
                  rx="6"
                  fill={colors.fill}
                  fillOpacity={isActive ? 0.98 : step.kind === "total" ? 0.92 : 0.82}
                  stroke={colors.stroke}
                  strokeWidth={isActive ? 2 : 1.2}
                  pointerEvents="none"
                />
                {step.kind !== "start" && step.pctOfCaHt > 0 ? (
                  <text
                    x={geom.x + geom.width / 2}
                    y={Math.max(geom.y + 12, 14)}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    className="fill-white tabular-nums"
                    pointerEvents="none"
                  >
                    {step.pctOfCaHt} %
                  </text>
                ) : null}
                <text
                  x={geom.x + geom.width / 2}
                  y={chartH + WATERFALL_AXIS.labelY}
                  textAnchor="middle"
                  fontSize={WATERFALL_AXIS.label.fontSize}
                  fontWeight={WATERFALL_AXIS.label.fontWeight}
                  className={WATERFALL_AXIS_STYLES.label}
                >
                  {step.label}
                </text>
                <text
                  x={geom.x + geom.width / 2}
                  y={chartH + WATERFALL_AXIS.valueY}
                  textAnchor="middle"
                  fontSize={WATERFALL_AXIS.value.fontSize}
                  fontWeight={WATERFALL_AXIS.value.fontWeight}
                  className={WATERFALL_AXIS_STYLES.value}
                >
                  {formatDelta(step, fmt.euro)}
                </text>
                <text
                  x={geom.x + geom.width / 2}
                  y={chartH + WATERFALL_AXIS.pctY}
                  textAnchor="middle"
                  fontSize={WATERFALL_AXIS.pct.fontSize}
                  fontWeight={WATERFALL_AXIS.pct.fontWeight}
                  className={WATERFALL_AXIS_STYLES.pct}
                >
                  {step.pctOfCaHt} %
                </text>
              </g>
            );
          })}
        </svg>
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200/70 bg-white/55 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:text-white/40">
          = Valeur nette
        </span>
        <div className="text-right">
          <span className="font-display text-base font-bold tabular-nums text-teal-700 dark:text-teal-300">
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
                  ? "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-500/10 dark:text-teal-200 dark:hover:bg-teal-500/15"
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
