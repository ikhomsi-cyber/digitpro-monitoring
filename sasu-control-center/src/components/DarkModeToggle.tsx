"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { DARK_MODE_LOCAL_STORAGE_KEY } from "@/lib/dark-mode-flag";

function readDarkFromDom(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Bascule la classe `dark` sur `<html>` et synchronise le localStorage.
 * L’état initial au premier paint est appliqué par le script inline du layout.
 */
export function DarkModeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(readDarkFromDom());
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(DARK_MODE_LOCAL_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* no-op */
    }
    setDark(next);
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      title={dark ? "Passer en thème clair" : "Passer en thème sombre"}
      className={clsx(
        "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950",
        ready && dark
          ? "border-amber-400/50 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50"
          : "border-ink-300 bg-white text-ink-800 hover:border-ink-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-ink-500"
      )}
    >
      {ready && dark ? <Sun className="h-5 w-5" strokeWidth={2} aria-hidden /> : null}
      {ready && !dark ? <Moon className="h-5 w-5" strokeWidth={2} aria-hidden /> : null}
      {!ready ? <span className="h-5 w-5" aria-hidden /> : null}
      <span className="sr-only">{dark ? "Thème sombre actif" : "Thème clair actif"}</span>
    </button>
  );
}
