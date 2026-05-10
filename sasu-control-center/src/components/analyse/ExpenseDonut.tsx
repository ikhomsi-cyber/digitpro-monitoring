"use client";

import type { LucideIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export type DonutSegment = {
  name: string;
  value: number;
  color: string;
  Icon: LucideIcon;
};

function iconPositionsPx(
  segments: Pick<DonutSegment, "value">[],
  cx: number,
  cy: number,
  radius: number
): { x: number; y: number }[] {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return segments.map(() => ({ x: cx, y: cy }));
  let cumulative = 0;
  return segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const mid = cumulative + sweep / 2;
    cumulative += sweep;
    const rad = ((mid - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad)
    };
  });
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
  const cx = size / 2;
  const cy = size / 2;
  const iconR = size * 0.33;

  const chartData = segments.filter((s) => s.value > 0);
  const positions =
    chartData.length > 0 ? iconPositionsPx(chartData, cx, cy, iconR) : [];

  const pieRows =
    chartData.length > 0 ? chartData : [{ name: "_empty", value: 1, color: "#e2e8f0" }];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieRows}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={chartData.length > 1 ? 1.6 : 0}
            stroke="#f8fafc"
            strokeWidth={2}
            cornerRadius={6}
            startAngle={90}
            endAngle={-270}
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

      {chartData.map((seg, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const Icon = seg.Icon;
        return (
          <div
            key={`well-${seg.name}-${i}`}
            className="pointer-events-none absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white shadow-sm shadow-slate-900/6"
            style={{
              left: pos.x,
              top: pos.y,
              borderColor: seg.color,
              color: seg.color
            }}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
          </div>
        );
      })}

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
