"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  Briefcase,
  LayoutDashboard,
  User,
  type LucideIcon
} from "lucide-react";
import { clsx } from "clsx";

const ITEMS: readonly {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (ctx: { scope: string | null; panel: string | null; section: string | null }) => boolean;
}[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: ({ scope, panel, section }) =>
      panel !== "lmnp" && (section == null || section === "") && scope == null
  },
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
 * Raccourcis périmètre façon barre horizontale type OneFootball « Compositions » :
 * pilules capsule avec picto + libellé centrés, scroll si besoin.
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
    <nav className="mt-4 sm:mt-5" aria-label="Périmètre tableau de bord">
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-white/40">
        Périmètre
      </p>
      <div
        className={clsx(
          "-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-1 sm:mx-0 sm:px-0",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <div className="flex min-w-full flex-nowrap justify-center gap-2.5 sm:gap-3">
          {ITEMS.map((item) => {
            const active = item.match(ctx);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-full px-5 py-3 text-center transition sm:px-6 sm:py-3",
                  "min-h-[76px] min-w-[6.25rem] sm:min-w-[7.25rem]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 dark:focus-visible:ring-white/35 dark:focus-visible:ring-offset-black",
                  active
                    ? "border border-ink-900/18 bg-white text-ink-950 shadow-sm ring-1 ring-ink-900/[0.05] dark:border-white dark:bg-transparent dark:text-white dark:shadow-none dark:ring-0"
                    : clsx(
                        "border border-transparent text-ink-900",
                        "bg-ink-200/90 hover:bg-ink-300/90 dark:bg-[#1e1e1e] dark:text-white dark:hover:bg-[#2a2a2a]"
                      )
                )}
              >
                <Icon
                  className={clsx(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "opacity-100" : "opacity-80 dark:opacity-90"
                  )}
                  strokeWidth={active ? 2.15 : 1.85}
                  aria-hidden
                />
                <span className="text-center text-[11px] font-semibold leading-tight tracking-tight sm:text-[12px]">
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
