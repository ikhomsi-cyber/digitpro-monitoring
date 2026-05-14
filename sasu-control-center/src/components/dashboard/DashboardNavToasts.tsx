"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Building2, Briefcase, User, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const ITEMS: readonly {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (ctx: { scope: string | null; panel: string | null; section: string | null }) => boolean;
}[] = [
  {
    href: "/dashboard?section=activite",
    label: "Activité",
    icon: Activity,
    match: ({ panel, section }) => panel !== "lmnp" && section === "activite"
  },
  {
    href: "/dashboard?section=sasu&scope=pro",
    label: "SASU",
    icon: Briefcase,
    match: ({ panel, section }) => panel !== "lmnp" && section === "sasu"
  },
  {
    href: "/dashboard?section=private&scope=personal",
    label: "Privé",
    icon: User,
    match: ({ panel, section }) => panel !== "lmnp" && section === "private"
  },
  {
    href: "/dashboard?panel=lmnp",
    label: "LMNP",
    icon: Building2,
    match: ({ panel }) => panel === "lmnp"
  }
];

/**
 * Raccourcis périmètre : barre sticky sous la top nav, pilules compactes,
 * navigation client sans scroll vers le haut (`scroll={false}`).
 */
export function DashboardNavToasts() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");
  const panel = searchParams.get("panel");
  const section = searchParams.get("section");

  if (!pathname.startsWith("/dashboard")) return null;

  const ctx = { scope, panel, section };

  return (
    <nav
      className={clsx(
        "sticky isolate z-[35] -mx-4 mb-3 border-b py-1.5 transition-colors",
        "top-[calc(env(safe-area-inset-top)+4.35rem)] sm:top-[calc(env(safe-area-inset-top)+4.65rem)]",
        "border-black/[0.06] bg-transparent text-ink-900",
        "dark:border-white/[0.08] dark:bg-transparent dark:text-zinc-100"
      )}
      aria-label="Périmètre tableau de bord"
    >
      <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-zinc-500">
        Périmètre
      </p>
      <div
        className={clsx(
          "overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-0.5 sm:px-0",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <div className="flex min-w-full flex-nowrap justify-center gap-2 sm:gap-2.5">
          {ITEMS.map((item) => {
            const active = item.match(ctx);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 text-center transition sm:px-4 sm:py-2",
                  "min-h-0 min-w-[4.75rem] sm:min-w-[5.25rem]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 dark:focus-visible:ring-emerald-400/50 dark:focus-visible:ring-offset-[#050505]",
                  active
                    ? clsx(
                        "border border-ink-900/18 bg-white text-ink-950 shadow-sm ring-1 ring-ink-900/[0.05]",
                        "dark:border-emerald-400/45 dark:bg-emerald-500/[0.14] dark:text-emerald-50 dark:shadow-[0_0_28px_rgba(16,185,129,0.2)] dark:ring-1 dark:ring-emerald-400/25"
                      )
                    : clsx(
                        "border border-transparent",
                        "bg-ink-200/90 text-ink-900 hover:bg-ink-300/90",
                        "dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/95"
                      )
                )}
              >
                <Icon
                  className={clsx(
                    "h-4 w-4 shrink-0 text-current",
                    active ? "opacity-100" : "opacity-85 dark:opacity-90"
                  )}
                  strokeWidth={active ? 2.1 : 1.75}
                  aria-hidden
                />
                <span className="text-center text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
