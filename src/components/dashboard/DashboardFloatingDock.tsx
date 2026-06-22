"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Banknote, ChartNoAxesCombined, Gauge, House, ScanSearch } from "lucide-react";
import { clsx } from "clsx";
import { isDashboardAnalyticsPanel } from "@/lib/dashboard-panel";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";
import { useOptionalDashboardSection } from "@/components/dashboard/DashboardSectionContext";

type Tab = {
  href: string;
  label: string;
  icon: typeof House;
  isActive: (ctx: {
    scope: string | null;
    panel: string | null;
    hash: string;
    section: string | null;
  }) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: House,
    isActive: ({ scope, panel, section }) =>
      !isDashboardAnalyticsPanel(panel) && (section == null || section === "") && scope == null
  },
  {
    href: "/dashboard?section=activite",
    label: "Activité",
    icon: Gauge,
    isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && section === "activite"
  },
  {
    href: "/dashboard?panel=valeur-reelle",
    label: "Valeur",
    icon: Banknote,
    isActive: ({ panel }) => panel === "valeur-reelle"
  },
  {
    href: "/dashboard?section=sasu&scope=pro",
    label: "SASU",
    icon: ChartNoAxesCombined,
    isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && section === "sasu"
  },
  {
    href: "/dashboard?section=categorisation",
    label: "Catég.",
    icon: ScanSearch,
    isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && section === "categorisation"
  }
];

/** Dock iOS flottant — mobile uniquement. */
export function DashboardFloatingDock() {
  const pathname = usePathname() ?? "";
  const fallbackSearchParams = useSearchParams();
  const sectionCtx = useOptionalDashboardSection();
  const searchParams =
    sectionCtx?.searchParams ??
    new URLSearchParams(fallbackSearchParams.toString());
  const scope = searchParams.get("scope");
  const panel = searchParams.get("panel");
  const section = searchParams.get("section");
  const [hash, setHash] = useState("");

  useEffect(() => {
    setHash(typeof window !== "undefined" ? window.location.hash : "");
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  if (!pathname.startsWith("/dashboard") && pathname !== "/categorisation") return null;

  const ctx = { scope, panel, hash, section };
  const onDashboardTabClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!pathname.startsWith("/dashboard") || !href.startsWith("/dashboard") || !sectionCtx) return;
    // LMNP panel is server-rendered — keep a full navigation when leaving it.
    if (panel === "lmnp") return;
    event.preventDefault();
    sectionCtx.navigateWithinDashboard(href);
  };

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] animate-floatIn px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Navigation principale"
    >
      <div
        className={clsx(
          "pointer-events-auto mx-auto flex max-w-[27rem] items-center justify-between gap-1 rounded-[1.85rem] border px-2 py-2 backdrop-blur-2xl",
          "border-ink-200/90 bg-white/94 text-ink-900 shadow-[0_18px_60px_-22px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.9)]",
          "dark:border-cyan-100/[0.10] dark:bg-[#082a31]/88 dark:text-white",
          "dark:shadow-[0_18px_60px_-22px_rgba(0,18,24,0.88),inset_0_1px_0_rgba(255,255,255,0.08)]"
        )}
      >
        {TABS.map((tab) => {
          const active = tab.isActive(ctx);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              prefetch={!tab.href.includes("#")}
              scroll={false}
              onClick={tab.href.startsWith("/dashboard") ? onDashboardTabClick(tab.href) : undefined}
              className={clsx(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-[1.35rem] px-1 py-2 transition",
                active
                  ? "bg-emerald-50 shadow-sm dark:bg-emerald-500/[0.14] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "hover:bg-ink-50 dark:hover:bg-white/[0.055]"
              )}
            >
              {active ? (
                <span
                  className="absolute inset-x-1 top-1 h-10 rounded-[1.15rem] bg-emerald-200/40 blur-sm dark:bg-emerald-300/10"
                  aria-hidden
                />
              ) : null}
              <span
                className={clsx(
                  "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full transition",
                  active
                    ? "bg-emerald-500/12 text-emerald-700 shadow-[0_8px_20px_-14px_rgba(16,185,129,0.55)] dark:bg-emerald-500/20 dark:text-white dark:shadow-[0_10px_26px_-18px_rgba(45,212,191,0.7)]"
                    : "text-ink-500 dark:text-white/72"
                )}
              >
                <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.45 : 2.05} aria-hidden />
                <span className="sr-only">{tab.label}</span>
              </span>
              <span
                className={clsx(
                  "relative z-[1] mt-1 max-w-[4.2rem] truncate text-center text-[10px] font-bold leading-none tracking-tight",
                  active ? "text-emerald-800 dark:text-white" : "text-ink-500 dark:text-white/72"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Sidebar premium — desktop uniquement. */
export function DashboardDesktopSidebar() {
  const pathname = usePathname() ?? "";
  const fallbackSearchParams = useSearchParams();
  const sectionCtx = useOptionalDashboardSection();
  const searchParams =
    sectionCtx?.searchParams ??
    new URLSearchParams(fallbackSearchParams.toString());
  const scope = searchParams.get("scope");
  const panel = searchParams.get("panel");
  const section = searchParams.get("section");
  const [hash, setHash] = useState("");

  useEffect(() => {
    setHash(typeof window !== "undefined" ? window.location.hash : "");
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  if (!pathname.startsWith("/dashboard") && pathname !== "/categorisation") return null;

  const ctx = { scope, panel, hash, section };
  const onDashboardTabClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!pathname.startsWith("/dashboard") || !href.startsWith("/dashboard") || !sectionCtx) return;
    // LMNP panel is server-rendered — keep a full navigation when leaving it.
    if (panel === "lmnp") return;
    event.preventDefault();
    sectionCtx.navigateWithinDashboard(href);
  };

  return (
    <aside className="fixed left-4 top-4 z-50 hidden h-[calc(100dvh-2rem)] w-24 flex-col rounded-[2rem] border border-ink-200/70 bg-white/85 p-3 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#06242b]/85 dark:shadow-[0_24px_90px_-28px_rgba(0,0,0,0.75)] lg:flex">
      <div className="flex h-full flex-col items-center">
        <Link
          href="/dashboard"
          onClick={onDashboardTabClick("/dashboard")}
          className="transition hover:opacity-90"
          aria-label="Dashboard"
        >
          <PremiumIconBadge icon={House} size="lg" />
        </Link>
        <nav className="mt-7 flex w-full flex-1 flex-col items-stretch gap-2" aria-label="Navigation desktop">
          {TABS.map((tab) => {
            const active = tab.isActive(ctx);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={!tab.href.includes("#")}
                scroll={false}
                onClick={tab.href.startsWith("/dashboard") ? onDashboardTabClick(tab.href) : undefined}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center transition",
                  active
                    ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/45 dark:bg-emerald-500/[0.16] dark:text-white dark:shadow-[0_0_26px_rgba(16,185,129,0.18)]"
                    : "border-ink-200/70 bg-white/60 text-ink-500 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800 dark:border-white/8 dark:bg-white/[0.035] dark:text-white/48 dark:hover:bg-white/[0.07] dark:hover:text-white/78"
                )}
              >
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.25 : 1.85} aria-hidden />
                <span className="text-[11px] font-semibold leading-tight tracking-tight">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
