"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";

const STORAGE_KEY = "privacyBlur";
const HTML_CLASS = "privacy-blur";

/** Returns true if the document currently has the privacy class on <html>. */
function readInitial(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(HTML_CLASS);
}

/**
 * Top-bar toggle that blurs every element flagged with `data-private`
 * across the app. State persists in localStorage and survives reloads
 * (the layout pre-applies the class before paint to avoid flicker).
 */
export function PrivacyToggle() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEnabled(readInitial());
    setHydrated(true);
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    const root = document.documentElement;
    if (next) root.classList.add(HTML_CLASS);
    else root.classList.remove(HTML_CLASS);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Afficher les montants" : "Masquer les montants"}
      className={clsx(
        "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition",
        hydrated && enabled
          ? "border-brand-500 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-400 dark:bg-brand-950/50 dark:text-brand-200 dark:hover:bg-brand-900/40"
          : "border-ink-300 bg-white text-ink-900 hover:border-ink-400 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-ink-500"
      )}
    >
      {hydrated && enabled ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {hydrated && enabled ? "Chiffres masqués" : "Masquer les chiffres"}
      </span>
    </button>
  );
}
