"use client";

import { useEffect, useState } from "react";
import { AppPageLoader } from "@/components/ui/AppPageLoader";

const MIN_VISIBLE_MS = 380;
const FADE_MS = 480;

/**
 * Splash unique au premier paint — reste monté dans le layout pour éviter
 * les écrans de chargement empilés (root + route loading.tsx).
 */
export function AppLaunchOverlay() {
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    if (phase !== "visible") return;

    let cancelled = false;
    const minShownUntil = Date.now() + MIN_VISIBLE_MS;

    const startFadeOut = () => {
      const wait = Math.max(0, minShownUntil - Date.now());
      window.setTimeout(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          setPhase("fading");
          window.setTimeout(() => {
            if (!cancelled) setPhase("hidden");
          }, FADE_MS);
        });
      }, wait);
    };

    if (document.readyState === "complete") {
      startFadeOut();
    } else {
      window.addEventListener("load", startFadeOut, { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, [phase]);

  if (phase === "hidden") return null;

  return <AppPageLoader exiting={phase === "fading"} />;
}
