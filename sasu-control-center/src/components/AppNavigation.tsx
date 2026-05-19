"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, Briefcase, Gem, LayoutDashboard, Menu, Tags, User, X } from "lucide-react";
import { isDashboardAnalyticsPanel } from "@/lib/dashboard-panel";
import { clsx } from "clsx";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  isActive: (pathname: string, scope: string | null, panel: string | null) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Vue d’ensemble du pilotage",
    icon: LayoutDashboard,
    isActive: (pathname, scope, panel) =>
      pathname.startsWith("/dashboard") && scope == null && !isDashboardAnalyticsPanel(panel)
  },
  {
    href: "/dashboard?scope=pro",
    label: "SASU",
    description: "Activité société",
    icon: Briefcase,
    isActive: (pathname, scope, panel) =>
      pathname.startsWith("/dashboard") && scope === "pro" && !isDashboardAnalyticsPanel(panel)
  },
  {
    href: "/dashboard?scope=personal",
    label: "Privé",
    description: "Finances personnelles",
    icon: User,
    isActive: (pathname, scope, panel) =>
      pathname.startsWith("/dashboard") && scope === "personal" && !isDashboardAnalyticsPanel(panel)
  },
  {
    href: "/dashboard?panel=lmnp",
    label: "LMNP",
    description: "Bien locatif Argenteuil",
    icon: Building2,
    isActive: (pathname, _scope, panel) =>
      pathname.startsWith("/dashboard") && panel === "lmnp"
  },
  {
    href: "/dashboard?panel=valeur-reelle",
    label: "Valeur réelle",
    description: "Analyse charges & avantages cachés",
    icon: Gem,
    isActive: (pathname, _scope, panel) =>
      pathname.startsWith("/dashboard") && panel === "valeur-reelle"
  },
  {
    href: "/categorisation",
    label: "Catégorisation",
    description: "Classer les transactions Powens",
    icon: Tags,
    isActive: (pathname) => pathname.startsWith("/categorisation")
  }
];

function useNavActive() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");
  const panel = searchParams.get("panel");
  return { pathname, scope, panel };
}

/** Barre d’accès rapide — desktop uniquement (placer dans la colonne centrale d’une grille `nav`). */
export function AppNavigationDesktop() {
  const { pathname, scope, panel } = useNavActive();

  return (
    <nav
      className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-ink-200/90 bg-white/90 p-1 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-black/40 dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]"
      aria-label="Accès rapide aux sections"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname, scope, panel);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? "page" : undefined}
            title={item.description}
            className={clsx(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-3.5 sm:text-[13px]",
              active
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] dark:from-emerald-500 dark:to-emerald-700 dark:text-white"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Menu mobile : déclencheur + feuille basse (thumb-friendly, ferme au changement de route). */
export function AppNavigationMobile() {
  const { pathname, scope, panel } = useNavActive();
  const panelId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [panelShown, setPanelShown] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      setPanelShown(false);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPanelShown(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    close();
  }, [pathname, scope, panel, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={titleId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink-800 shadow-sm transition hover:border-ink-400 hover:bg-ink-50 active:scale-[0.98] dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-ink-500 dark:hover:bg-ink-700"
      >
        <Menu className="h-4 w-4 shrink-0 text-ink-500 dark:text-ink-400" strokeWidth={2} aria-hidden />
        Menu
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="presentation">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-[3px] transition-opacity duration-200 dark:bg-black/60"
            onClick={close}
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={clsx(
              "relative z-[101] max-h-[min(85dvh,32rem)] w-full overflow-hidden rounded-t-3xl border border-b-0 border-ink-200/90 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:border-ink-700 dark:bg-ink-900 dark:shadow-[0_-8px_40px_rgba(0,0,0,0.45)] motion-reduce:transition-none",
              panelShown ? "translate-y-0" : "translate-y-full"
            )}
          >
            <div className="flex justify-center pt-3 pb-1" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-ink-300 dark:bg-ink-600" />
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 pb-3 pt-1 dark:border-ink-800">
              <div>
                <p id={titleId} className="font-display text-base font-semibold text-ink-900 dark:text-ink-50">
                  Où allez-vous ?
                </p>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">DigitPro · navigation principale</p>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={close}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-ink-50 text-ink-700 transition hover:bg-ink-100 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <nav className="max-h-[55dvh] overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1" aria-label="Navigation principale">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active = item.isActive(pathname, scope, panel);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch
                        onClick={close}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "flex min-h-[52px] items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99]",
                          active
                            ? "bg-brand-500 text-white shadow-md shadow-brand-500/20 dark:bg-brand-600"
                            : "bg-ink-50/80 text-ink-900 hover:bg-ink-100 dark:bg-ink-800/50 dark:text-ink-50 dark:hover:bg-ink-800"
                        )}
                      >
                        <span
                          className={clsx(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                            active
                              ? "border-white/30 bg-white/15 text-white"
                              : "border-ink-200 bg-white text-ink-600 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-300"
                          )}
                          aria-hidden
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold leading-tight">{item.label}</span>
                          <span
                            className={clsx(
                              "mt-0.5 block text-xs leading-snug",
                              active ? "text-white/85" : "text-ink-500 dark:text-ink-400"
                            )}
                          >
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}