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
export function DarkModeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(readDarkFromDom());
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
        "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-2xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950",
        "border-ink-200/90 bg-white/90 text-ink-700 hover:bg-white dark:border-cyan-100/[0.16] dark:bg-cyan-50/[0.10] dark:text-white dark:hover:bg-cyan-50/[0.16]",
        className
      )}
    >
      {/* Les deux icônes sont rendues côté serveur ; la classe `dark` sur <html>
          (posée par le script inline avant le paint) choisit laquelle afficher.
          Évite le cercle vide au lancement et tout mismatch d'hydratation. */}
      <Moon className="h-5 w-5 dark:hidden" strokeWidth={2} aria-hidden />
      <Sun className="hidden h-5 w-5 dark:block" strokeWidth={2} aria-hidden />
      <span className="sr-only">{dark ? "Thème sombre actif" : "Thème clair actif"}</span>
    </button>
  );
}
