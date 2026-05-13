"use client";

import { Suspense } from "react";
import { AppNavigationDesktop, AppNavigationMobile } from "@/components/AppNavigation";
import { clsx } from "clsx";

type StickyTopOffset = "dashboard" | "lmnp";

const TOP_OFFSET: Record<StickyTopOffset, string> = {
  /** Sous la barre logo + actions du dashboard (~py-2 / py-3 + contrôles ~44px). */
  dashboard:
    "top-[calc(env(safe-area-inset-top)+3.75rem)] sm:top-[calc(env(safe-area-inset-top)+4.25rem)]",
  /** Sous la barre fine LMNP (logo seul, py-2). */
  lmnp: "top-[calc(env(safe-area-inset-top)+3rem)] sm:top-[calc(env(safe-area-inset-top)+3.25rem)]"
};

/**
 * Navigation sections (desktop + mobile) sous le header, collée sous la barre du haut au scroll.
 */
export function AppSectionNav({
  offset,
  maxWidthClass = "max-w-6xl",
  className
}: {
  offset: StickyTopOffset;
  /** Alignement avec le contenu (ex. `max-w-5xl` sur LMNP). */
  maxWidthClass?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "sticky z-[35] -mx-4 border-b border-ink-200/80 bg-white/90 py-2.5 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-black/50 dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.65)] sm:-mx-6",
        TOP_OFFSET[offset],
        className
      )}
    >
      <div
        className={clsx(
          "mx-auto flex w-full flex-col items-center justify-center gap-2 px-4 sm:flex-row sm:px-6",
          maxWidthClass
        )}
      >
        <div className="hidden w-full justify-center md:flex">
          <Suspense fallback={null}>
            <AppNavigationDesktop />
          </Suspense>
        </div>
        <div className="flex w-full justify-center md:hidden">
          <Suspense fallback={null}>
            <AppNavigationMobile />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
