"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AppPageLoader } from "@/components/ui/AppPageLoader";

const MIN_VISIBLE_MS = 560;
const FADE_MS = 480;
const DASHBOARD_READY_EVENT = "digitpro:dashboard-ready";
const DASHBOARD_READY_DATASET = "digitproDashboardReady";
const DASHBOARD_TRANSITION_DATASET = "digitproDashboardTransition";
const MAX_DASHBOARD_WAIT_MS = 6_000;

/**
 * Splash unique au premier paint. Sur le dashboard, il reste opaque jusqu'à
 * ce que le contenu client ait été peint au moins une fois : évite de révéler
 * brièvement les filtres mensuels pendant le chargement post-connexion.
 */
export function AppLaunchOverlay() {
  const pathname = usePathname() ?? "";
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");
  const previousPathname = useRef(pathname);

  // Après la connexion, Next remplace la page sans remonter le layout racine.
  // Bloque l'app-shell avant le paint : même un loading.tsx qui se démonte vite
  // ne peut pas laisser entrevoir les filtres mensuels.
  useLayoutEffect(() => {
    const isDashboard = pathname.startsWith("/dashboard");
    const enteringDashboard = isDashboard && !previousPathname.current.startsWith("/dashboard");
    previousPathname.current = pathname;
    if (!isDashboard) {
      delete document.documentElement.dataset[DASHBOARD_TRANSITION_DATASET];
      return;
    }

    delete document.documentElement.dataset[DASHBOARD_READY_DATASET];
    document.documentElement.dataset[DASHBOARD_TRANSITION_DATASET] = "loading";
    if (enteringDashboard) setPhase("visible");
  }, [pathname]);

  useEffect(() => {
    if (phase !== "visible") return;

    let cancelled = false;
    let fadeTimer: number | undefined;
    let safetyTimer: number | undefined;
    let fadeStarted = false;
    const minShownUntil = Date.now() + MIN_VISIBLE_MS;

    const startFadeOut = () => {
      if (cancelled || fadeStarted) return;
      fadeStarted = true;
      if (isDashboard) {
        document.documentElement.dataset[DASHBOARD_TRANSITION_DATASET] = "revealing";
      }
      const wait = Math.max(0, minShownUntil - Date.now());
      fadeTimer = window.setTimeout(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          setPhase("fading");
        });
      }, wait);
    };

    const isDashboard = pathname.startsWith("/dashboard");
    const onDashboardReady = () => startFadeOut();

    if (isDashboard) {
      window.addEventListener(DASHBOARD_READY_EVENT, onDashboardReady, { once: true });
      if (document.documentElement.dataset[DASHBOARD_READY_DATASET] === "1") {
        startFadeOut();
      }
      // Une erreur d'hydratation ne doit jamais bloquer l'application derrière le splash.
      safetyTimer = window.setTimeout(startFadeOut, MAX_DASHBOARD_WAIT_MS);
    } else {
      if (document.readyState === "complete") {
        startFadeOut();
      } else {
        window.addEventListener("load", startFadeOut, { once: true });
      }
    }

    return () => {
      cancelled = true;
      if (fadeTimer != null) window.clearTimeout(fadeTimer);
      if (safetyTimer != null) window.clearTimeout(safetyTimer);
      window.removeEventListener(DASHBOARD_READY_EVENT, onDashboardReady);
      window.removeEventListener("load", startFadeOut);
    };
  }, [pathname, phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = window.setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  return <AppPageLoader exiting={phase === "fading"} />;
}
