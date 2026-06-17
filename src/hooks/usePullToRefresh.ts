"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PullState = "idle" | "pulling" | "refreshing";

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  {
    disabled = false,
    threshold = 72
  }: {
    disabled?: boolean;
    threshold?: number;
  } = {}
) {
  const [pullState, setPullState] = useState<PullState>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const pullStateRef = useRef<PullState>("idle");
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  pullStateRef.current = pullState;
  pullDistanceRef.current = pullDistance;
  onRefreshRef.current = onRefresh;

  const reset = useCallback(() => {
    startYRef.current = null;
    setPullState("idle");
    setPullDistance(0);
  }, []);

  useEffect(() => {
    if (disabled) return;

    const onTouchStart = (event: TouchEvent) => {
      if (pullStateRef.current === "refreshing" || window.scrollY > 2) return;
      startYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startYRef.current == null || pullStateRef.current === "refreshing") return;
      const y = event.touches[0]?.clientY ?? 0;
      const delta = y - startYRef.current;
      if (delta > 0 && window.scrollY <= 0) {
        event.preventDefault();
        pullStateRef.current = "pulling";
        setPullState("pulling");
        setPullDistance(Math.min(delta * 0.45, threshold * 1.35));
      }
    };

    const onTouchEnd = async () => {
      if (startYRef.current == null) return;
      const shouldRefresh =
        pullStateRef.current === "pulling" && pullDistanceRef.current >= threshold;
      startYRef.current = null;

      if (!shouldRefresh) {
        reset();
        return;
      }

      pullStateRef.current = "refreshing";
      setPullState("refreshing");
      setPullDistance(threshold * 0.55);
      try {
        await onRefreshRef.current();
      } finally {
        reset();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, reset, threshold]);

  const progress = Math.min(1, pullDistance / threshold);

  return {
    pullState,
    pullDistance,
    progress,
    isRefreshing: pullState === "refreshing",
    isPulling: pullState === "pulling"
  };
}
