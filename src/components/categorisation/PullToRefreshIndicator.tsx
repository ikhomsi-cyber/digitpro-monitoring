"use client";

import { clsx } from "clsx";
import { ArrowDown, RefreshCw } from "lucide-react";

export function PullToRefreshIndicator({
  visible,
  pullDistance,
  progress,
  refreshing
}: {
  visible: boolean;
  pullDistance: number;
  progress: number;
  refreshing: boolean;
}) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center transition-opacity duration-150"
      style={{ top: `calc(env(safe-area-inset-top) + ${Math.max(8, pullDistance - 28)}px)` }}
      aria-hidden
    >
      <div
        className={clsx(
          "grid h-9 w-9 place-items-center rounded-full border border-ink-200/70 bg-white/95 text-ink-600 shadow-md backdrop-blur-sm dark:border-white/12 dark:bg-[#0b3038]/95 dark:text-white/75",
          refreshing && "border-brand-300/40 text-brand-600 dark:border-brand-400/30 dark:text-brand-300"
        )}
      >
        {refreshing ? (
          <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2.2} />
        ) : (
          <ArrowDown
            className="h-4 w-4 transition-transform duration-150"
            style={{ transform: `rotate(${Math.round(progress * 180)}deg)` }}
            strokeWidth={2.2}
          />
        )}
      </div>
    </div>
  );
}
