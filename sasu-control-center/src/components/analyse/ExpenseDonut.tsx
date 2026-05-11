"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { PieLabelRenderProps } from "recharts";

export type DonutSegment = {
  name: string;
  value: number;
  color: string;
  Icon: LucideIcon;
};

const RAD = Math.PI / 180;

/** Icône minuscule au milieu de l’anneau pour chaque secteur (sauf parts &lt; ~3 %). */
function DonutSegmentMiniIcon(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, payload, percent } = props;
  const seg = payload as DonutSegment | undefined;
  if (!seg || seg.name === "_empty" || percent == null || percent < 0.03) return null;

  const Icon = seg.Icon;
  if (!Icon) return null;

  const ir = Number(innerRadius);
  const or = Number(outerRadius);
  if (!Number.isFinite(ir) || !Number.isFinite(or) || or - ir < 10) return null;

  const angle = midAngle ?? 0;
  const rMid = (ir + or) / 2;
  const mx = cx + rMid * Math.cos(-angle * RAD);
  const my = cy + rMid * Math.sin(-angle * RAD);

  /** ~10 px — pictogramme volontairement très petit */
  const box = 11;
  const half = box / 2;

  return (
    <g transform={`translate(${mx},${my})`} pointerEvents="none">
      <foreignObject x={-half} y={-half} width={box} height={box}>
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            color: "rgba(255,255,255,0.96)",
            filter: "drop-shadow(0 0.5px 1.2px rgba(0,0,0,0.45))"
          }}
        >
          <Icon className="h-[9px] w-[9px]" strokeWidth={2.35} aria-hidden />
        </div>
      </foreignObject>
    </g>
  );
}

export function ExpenseDonut({
  segments,
  centerTitle,
  centerAmountLabel,
  size = 260,
  onSegmentClick
}: {
  segments: DonutSegment[];
  centerTitle: string;
  centerAmountLabel: string;
  size?: number;
  /** Clic sur une part du donut (nom de catégorie). */
  onSegmentClick?: (segmentName: string) => void;
}) {
  const chartData = segments.filter((s) => s.value > 0);

  const pieRows: DonutSegment[] =
    chartData.length > 0
      ? chartData
      : [{ name: "_empty", value: 1, color: "#e2e8f0", Icon: MoreHorizontal }];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieRows}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius="74%"
            outerRadius="88%"
            paddingAngle={chartData.length > 1 ? 1.1 : 0}
            stroke="#ffffff"
            strokeWidth={2}
            cornerRadius={4}
            startAngle={90}
            endAngle={-270}
            label={DonutSegmentMiniIcon}
            labelLine={false}
            isAnimationActive
            animationDuration={550}
            style={{ cursor: onSegmentClick && chartData.length ? "pointer" : "default" }}
            onClick={(data, _index, e) => {
              e?.stopPropagation?.();
              if (!onSegmentClick || !chartData.length) return;
              if (data == null || typeof data !== "object") return;
              const sector = data as {
                payload?: DonutSegment;
                name?: unknown;
              };
              const payload = sector.payload;
              const raw = payload?.name ?? sector.name;
              if (raw == null || raw === "") return;
              const name = typeof raw === "string" ? raw : String(raw);
              if (name === "_empty") return;
              onSegmentClick(name);
            }}
          >
            {pieRows.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <p
          className="font-display text-[1.35rem] font-bold leading-tight tracking-tight text-slate-900 tabular-nums sm:text-2xl"
          data-private
        >
          {centerAmountLabel}
        </p>
        <p className="mt-1 text-[13px] font-medium text-slate-500">{centerTitle}</p>
      </div>
    </div>
  );
}
