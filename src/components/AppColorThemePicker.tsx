"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { clsx } from "clsx";
import {
  APP_COLOR_THEMES,
  APP_COLOR_THEME_STORAGE_KEY,
  DEFAULT_APP_COLOR_THEME,
  parseAppColorTheme,
  type AppColorTheme
} from "@/lib/app-color-theme";
import { syncAppChromeTheme } from "@/lib/sync-app-chrome-theme";

function readThemeFromDom(): AppColorTheme {
  if (typeof document === "undefined") return DEFAULT_APP_COLOR_THEME;
  return parseAppColorTheme(document.documentElement.dataset.colorTheme);
}

export function AppColorThemePicker() {
  const [theme, setTheme] = useState<AppColorTheme>(DEFAULT_APP_COLOR_THEME);

  useEffect(() => {
    setTheme(readThemeFromDom());
  }, []);

  const selectTheme = useCallback((nextTheme: AppColorTheme) => {
    const root = document.documentElement;
    root.dataset.colorTheme = nextTheme;
    try {
      window.localStorage.setItem(APP_COLOR_THEME_STORAGE_KEY, nextTheme);
    } catch {
      /* Le changement reste actif pour la session en cours. */
    }
    syncAppChromeTheme(root.classList.contains("dark"));
    setTheme(nextTheme);
  }, []);

  return (
    <div className="border-t border-ink-100 pt-4 dark:border-white/[0.06]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-white/70">
          <Palette className="h-4 w-4" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink-900 dark:text-white">Couleur de l’application</span>
          <span className="block text-xs text-ink-500 dark:text-white/45">Palettes premium inspirées de la finance moderne</span>
        </span>
      </div>

      <div role="radiogroup" aria-label="Couleur de l’application" className="mt-4 grid grid-cols-2 gap-2">
        {APP_COLOR_THEMES.map((option) => {
          const selected = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectTheme(option.id)}
              className={clsx(
                "relative flex min-h-[4.5rem] items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0a2b32]",
                selected
                  ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] shadow-[0_10px_24px_-18px_var(--app-accent-glow)]"
                  : "border-ink-200 bg-white hover:border-ink-300 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              )}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-inner"
                style={{ background: `linear-gradient(135deg, ${option.swatch}, color-mix(in srgb, ${option.swatch} 58%, #111827))` }}
                aria-hidden
              >
                {selected ? <Check className="h-4 w-4 text-white" strokeWidth={2.5} /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink-900 dark:text-white">{option.label}</span>
                <span className="block truncate text-[11px] text-ink-500 dark:text-white/45">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
