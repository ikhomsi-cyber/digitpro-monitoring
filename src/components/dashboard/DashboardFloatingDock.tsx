"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Banknote, ChartNoAxesCombined, Gauge, House, Landmark, Settings, Navigation, ShoppingBasket } from "lucide-react";
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
    href: "/dashboard?section=pilote",
    label: "Pilote",
    icon: Navigation,
    isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && section === "pilote"
  },
  { href: "/dashboard?section=courses", label: "Courses", icon: ShoppingBasket, isActive: ({ panel, section }) => !isDashboardAnalyticsPanel(panel) && (section === "courses" || section === "cours") },

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

  return <nav aria-label="Navigation principale" className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
   <div className="pointer-events-auto mx-auto flex max-w-sm items-end gap-2">
    {[{label:"Pro",tabs:TABS.slice(0,3)},{label:"Perso",tabs:TABS.slice(3)}].map(group=><div key={group.label} role="group" aria-label={group.label} style={{flex:group.tabs.length}} className="min-w-0 rounded-[1.35rem] border border-ink-200/70 bg-white/95 px-1 pb-1 pt-1.5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#06242b]/90">
     <p className="text-center text-[8px] font-medium uppercase leading-none tracking-[.15em] text-ink-400 dark:text-white/35">{group.label}</p>
     <div className="mt-0.5 flex">{group.tabs.map(tab=>{const active=tab.isActive(ctx),Icon=tab.icon;return <Link key={tab.label} href={tab.href} aria-current={active?"page":undefined} prefetch scroll={false} onClick={onDashboardTabClick(tab.href)} className={clsx("flex h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition",active?"bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200":"text-ink-500 hover:bg-ink-100 dark:text-white/50 dark:hover:bg-white/5")}><Icon size={18} strokeWidth={active?2.2:1.7} aria-hidden="true"/><span className="max-w-full truncate px-0.5 text-[9px] font-medium leading-none">{tab.label}</span></Link>;})}</div>
    </div>)}
   </div>
  </nav>;

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
          {TABS.map((tab,index) => {
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
                {index===0||index===3?<span className="text-[8px] font-normal uppercase tracking-widest text-ink-400">{index===0?"Pro":"Perso"}</span>:null}
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.25 : 1.85} aria-hidden />
                <span className="text-[11px] font-semibold leading-tight tracking-tight">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          href="/parametres"
          prefetch
          aria-current={pathname === "/parametres" ? "page" : undefined}
          className={clsx(
            "mt-2 flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-center transition",
            pathname === "/parametres"
              ? "border-emerald-300/60 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/45 dark:bg-emerald-500/[0.16] dark:text-white dark:shadow-[0_0_26px_rgba(16,185,129,0.18)]"
              : "border-ink-200/70 bg-white/60 text-ink-500 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800 dark:border-white/8 dark:bg-white/[0.035] dark:text-white/48 dark:hover:bg-white/[0.07] dark:hover:text-white/78"
          )}
          aria-label="Paramètres"
        >
          <Settings className="h-[21px] w-[21px]" strokeWidth={1.85} aria-hidden />
          <span className="text-[11px] font-semibold leading-tight tracking-tight">Réglages</span>
        </Link>
      </div>
    </aside>
  );
}
