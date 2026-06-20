import { clsx } from "clsx";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import {
  dashboardHeroSection,
  dashboardInsightCard,
  dashboardInsightGrid,
  dashboardSectionStack
} from "@/lib/dashboard-surfaces";

function InsightCardSkeleton({ pie = false }: { pie?: boolean }) {
  return (
    <div className={dashboardInsightCard}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <DashboardSkeleton className="h-3 w-20" />
          <DashboardSkeleton className="h-6 w-36" />
        </div>
        <div className="space-y-2 text-right">
          <DashboardSkeleton className="ml-auto h-7 w-24" />
          <DashboardSkeleton className="ml-auto h-3 w-20" />
        </div>
      </div>
      <DashboardSkeleton className="mt-3 h-5 w-full rounded-full" />
      {pie ? (
        <>
          <div
            className="relative mx-auto mt-4 flex h-64 w-64 max-w-full items-center justify-center rounded-full border-[14px] border-ink-200/55 bg-ink-50/40 dark:border-white/[0.08] dark:bg-[#06242b]/40"
            aria-hidden
          >
            <div className="space-y-1.5 text-center">
              <DashboardSkeleton className="mx-auto h-4 w-16" />
              <DashboardSkeleton className="mx-auto h-2.5 w-10" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <DashboardSkeleton key={index} className="h-8 rounded-full" />
            ))}
          </div>
          <DashboardSkeleton className="mx-auto mt-3 h-9 w-40 rounded-full" />
        </>
      ) : (
        <>
          <DashboardSkeleton className="mt-4 h-10 w-full rounded-full" />
          <DashboardSkeleton className="mt-3 h-3 w-56" />
        </>
      )}
    </div>
  );
}

/** Squelette de la page Valeur réelle — tous les blocs visibles avant le calcul client. */
export function ValeurReelleSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("scroll-mt-28 overflow-x-hidden", dashboardSectionStack, className)}
      aria-busy="true"
      aria-label="Chargement de la valeur réelle"
    >
      <section className={clsx(dashboardHeroSection, "w-full")}>
        <DashboardSkeleton className="mx-auto h-4 w-40" />
        <DashboardSkeleton className="mx-auto mt-3 h-12 w-52 sm:h-14 sm:w-60" />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <DashboardSkeleton className="h-9 w-36 rounded-full" />
          <DashboardSkeleton className="h-9 w-40 rounded-full" />
        </div>
        <DashboardSkeleton className="mx-auto mt-2 h-3 w-48" />
        <div className="mt-5 w-full max-w-lg px-1">
          <div className={clsx(dashboardInsightCard, "px-3 py-4 sm:px-4")}>
            <DashboardSkeleton className="h-40 w-full rounded-2xl sm:h-44" />
          </div>
          <DashboardSkeleton className="mx-auto mt-2 h-3 w-44" />
        </div>
      </section>

      <div className={dashboardInsightGrid}>
        <InsightCardSkeleton />
        <InsightCardSkeleton />
      </div>

      <div className={dashboardInsightGrid}>
        <InsightCardSkeleton pie />
        <InsightCardSkeleton pie />
      </div>

      <section className={clsx(dashboardInsightCard, "space-y-4")}>
        <div className="space-y-2">
          <DashboardSkeleton className="h-3 w-24" />
          <DashboardSkeleton className="h-6 w-40" />
          <DashboardSkeleton className="h-3 w-56" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-w-0 space-y-2">
              <DashboardSkeleton className="h-3 w-16" />
              <DashboardSkeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <InsightCardSkeleton pie />
      </section>
    </div>
  );
}
