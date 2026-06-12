"use client";

import { clsx } from "clsx";
import { valeurReelleWaterfallBarGeometry } from "@/lib/valeur-reelle-waterfall";
import type { ValeurReelleWaterfallStepKind } from "@/lib/valeur-reelle-waterfall";
import {
  VALEUR_REELLE_WATERFALL_COLORS,
  WATERFALL_AXIS_LAYOUT,
  WATERFALL_AXIS_STYLES,
  WATERFALL_AXIS_SVG_CLASS,
  WATERFALL_CHART_LAYOUT
} from "@/components/dashboard/waterfall-axis-styles";

export type ValeurReelleWaterfallSvgStep = {
  id: string;
  label: string;
  deltaEur: number;
  cumulativeEur: number;
  kind: ValeurReelleWaterfallStepKind;
  pctOfCaHt: number;
};

type Props = {
  steps: ValeurReelleWaterfallSvgStep[];
  formatDelta: (deltaEur: number) => string;
  ariaLabel: string;
  className?: string;
  activeStepId?: string | null;
  onStepHover?: (stepId: string | null) => void;
};

export function ValeurReelleWaterfallSvg({
  steps,
  formatDelta,
  ariaLabel,
  className,
  activeStepId = null,
  onStepHover
}: Props) {
  const { chartW, chartH, gap, barRx, barStrokeWidth, connectorDash, minWidth } =
    WATERFALL_CHART_LAYOUT;
  const axis = WATERFALL_AXIS_LAYOUT;
  const barW = (chartW - gap * (steps.length + 1)) / steps.length;
  const maxValue = Math.max(1, steps[0]?.cumulativeEur ?? 1);

  const geometries = steps.map((step, index) => {
    const prevCumulative = index === 0 ? 0 : (steps[index - 1]?.cumulativeEur ?? 0);
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
  });

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH + axis.labelAreaH}`}
      className={clsx("w-full", minWidth, WATERFALL_AXIS_SVG_CLASS, className)}
      role="img"
      aria-label={ariaLabel}
    >
      <rect
        x={0}
        y={chartH + 1}
        width={chartW}
        height={axis.labelAreaH - 1}
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
        const colors = VALEUR_REELLE_WATERFALL_COLORS[step.id] ?? VALEUR_REELLE_WATERFALL_COLORS.valeur_nette;
        const prevGeom = index > 0 ? geometries[index - 1] : null;
        const connectorY =
          index > 0 && step.kind === "decrease"
            ? chartH - (geometries[index - 1].prevCumulative / maxValue) * chartH
            : null;
        const isActive = activeStepId === step.id;
        const interactive = onStepHover != null;

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
                strokeDasharray={connectorDash}
              />
            ) : null}
            {interactive ? (
              <rect
                x={geom.x - 2}
                y={geom.y - 4}
                width={geom.width + 4}
                height={geom.height + 8}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => onStepHover?.(step.id)}
                onFocus={() => onStepHover?.(step.id)}
                onMouseLeave={() => {
                  if (activeStepId === step.id) onStepHover?.(null);
                }}
                onBlur={() => {
                  if (activeStepId === step.id) onStepHover?.(null);
                }}
                tabIndex={0}
                aria-label={`${step.label} ${formatDelta(step.deltaEur)}`}
              />
            ) : null}
            <rect
              x={geom.x}
              y={geom.y}
              width={geom.width}
              height={geom.height}
              rx={barRx}
              fill={colors.fill}
              fillOpacity={isActive ? 0.98 : step.kind === "total" ? 0.92 : 0.82}
              stroke={colors.stroke}
              strokeWidth={isActive ? 2 : barStrokeWidth}
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
              >
                {step.pctOfCaHt} %
              </text>
            ) : null}
            <text
              x={geom.x + geom.width / 2}
              y={chartH + axis.labelY}
              textAnchor="middle"
              fontSize={axis.label.fontSize}
              fontWeight={axis.label.fontWeight}
              className={WATERFALL_AXIS_STYLES.label}
            >
              {step.label}
            </text>
            <text
              x={geom.x + geom.width / 2}
              y={chartH + axis.valueY}
              textAnchor="middle"
              fontSize={axis.value.fontSize}
              fontWeight={axis.value.fontWeight}
              className={WATERFALL_AXIS_STYLES.value}
            >
              {formatDelta(step.deltaEur)}
            </text>
            <text
              x={geom.x + geom.width / 2}
              y={chartH + axis.pctY}
              textAnchor="middle"
              fontSize={axis.pct.fontSize}
              fontWeight={axis.pct.fontWeight}
              className={WATERFALL_AXIS_STYLES.pct}
            >
              {step.pctOfCaHt} %
            </text>
          </g>
        );
      })}
    </svg>
  );
}
