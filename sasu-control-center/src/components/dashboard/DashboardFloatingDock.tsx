"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Briefcase, Gem, Home, Tags, UserRound } from "lucide-react";
import { clsx } from "clsx";
import { isDashboardAnalyticsPanel } from "@/lib/dashboard-panel";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
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
    icon: Home,
    isActive: ({ scope, panel, section }) =>
      !isDashboardAnalyticsPanel(panel) && (section == null || section === "") && scope == null
  },
  {
    href: "/dashboard?section=activite",
    label: "Activité",
    icon: Activity,
    isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && section === "activite"
  },
  {
    href: "/dashboard?panel=valeur-reelle",
    label: "Valeur",
    icon: Gem,
    isActive: ({ panel }) => panel === "valeur-reelle"
  },
  {
    href: "/dashboard?section=private&scope=personal",
    label: "Privé",
    icon: UserRound,
    isActive: ({ scope, panel, section }) =>
      !isDashboardAnalyticsPanel(panel) && (section === "private" || (section == null && scope === "personal"))
  },
  {
    href: "/categorisation",
    label: "Catég.",
    icon: Tags,
    isActive: () => false
  },
  {
    href: "/dashboard?section=sasu&scope=pro",
    label: "SASU",
    icon: Briefcase,
    isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && section === "sasu"
  }
];

/** Dock iOS flottant — mobile uniquement. */
export function DashboardFloatingDock() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
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
  const isCategorisation = pathname === "/categorisation";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[90] animate-floatIn border-t border-white/[0.07] bg-black/55 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden"
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5">
        {TABS.map((tab) => {
          const active = tab.href === "/categorisation" ? isCategorisation : tab.isActive(ctx);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              prefetch={!tab.href.includes("#")}
              scroll={false}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5"
            >
              {active ? (
                <span className="absolute inset-x-0.5 -top-0.5 h-9 rounded-2xl bg-emerald-500/30 blur-md" aria-hidden />
              ) : null}
              <span
                className={clsx(
                  "relative z-[1] flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                  active
                    ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                    : "border-white/10 bg-white/5 text-white/55"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.75} aria-hidden />
                <span className="sr-only">{tab.label}</span>
              </span>
              <span
                className={clsx(
                  "relative z-[1] max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight",
                  active ? "text-white" : "text-white/45"
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
  const searchParams = useSearchParams();
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
  const isCategorisation = pathname === "/categorisation";

  return (
    <aside className="fixed left-4 top-4 z-50 hidden h-[calc(100dvh-2rem)] w-24 flex-col rounded-[2rem] border border-white/10 bg-black/45 p-3 shadow-[0_24px_90px_-28px_rgba(0,0,0,0.75)] backdrop-blur-2xl lg:flex">
      <div className="flex h-full flex-col items-center">
        <Link
          href="/dashboard"
          className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,0.18)]"
          aria-label="Dashboard"
        >
          <Home className="h-5 w-5" strokeWidth={2} aria-hidden />
        </Link>
        <nav className="mt-7 flex w-full flex-1 flex-col items-stretch gap-2" aria-label="Navigation desktop">
          {TABS.map((tab) => {
            const active = tab.href === "/categorisation" ? isCategorisation : tab.isActive(ctx);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={!tab.href.includes("#")}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center transition",
                  active
                    ? "border-emerald-400/45 bg-emerald-500/[0.16] text-white shadow-[0_0_26px_rgba(16,185,129,0.18)]"
                    : "border-white/8 bg-white/[0.035] text-white/48 hover:bg-white/[0.07] hover:text-white/78"
                )}
              >
                <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.2 : 1.75} aria-hidden />
                <span className="text-[10px] font-semibold leading-tight tracking-tight">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
