"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Home, Landmark, LineChart, UserRound } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "framer-motion";

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
    label: "Accueil",
    icon: Home,
    isActive: ({ scope, panel, section }) =>
      panel !== "lmnp" && (section == null || section === "") && scope == null
  },
  {
    href: "/dashboard?section=activite",
    label: "Activité",
    icon: Activity,
    isActive: ({ panel, section }) => panel !== "lmnp" && section === "activite"
  },
  {
    href: "/dashboard#dashboard-analytics",
    label: "Analytics",
    icon: LineChart,
    isActive: ({ hash, panel, section }) =>
      panel !== "lmnp" && (section == null || section === "") && hash === "#dashboard-analytics"
  },
  {
    href: "/dashboard#dashboard-fiscal",
    label: "Fiscalité",
    icon: Landmark,
    isActive: ({ hash, panel, section }) =>
      panel !== "lmnp" && (section == null || section === "") && hash === "#dashboard-fiscal"
  },
  {
    href: "/dashboard?section=private&scope=personal",
    label: "Profil",
    icon: UserRound,
    isActive: ({ scope, panel, section }) =>
      panel !== "lmnp" && (section === "private" || (section == null && scope === "personal"))
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

  if (!pathname.startsWith("/dashboard")) return null;

  const ctx = { scope, panel, hash, section };

  return (
    <motion.nav
      initial={{ y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-white/[0.07] bg-black/55 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden"
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5">
        {TABS.map((tab) => {
          const active = tab.isActive(ctx);
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
    </motion.nav>
  );
}
