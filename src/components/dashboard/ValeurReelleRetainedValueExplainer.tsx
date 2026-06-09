"use client";

import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { AlertTriangle, HelpCircle, Plus } from "lucide-react";
import type { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import type { ValeurReelleDailyBreakdown } from "@/lib/valeur-reelle-daily-value";

type Fmt = ReturnType<typeof useDashboardDisplayFormat>;

type ExplainerRow = {
  label: string;
  detail?: string;
  value: number;
  tone: "neutral" | "add" | "result";
};

function buildExplainerRows(breakdown: ValeurReelleDailyBreakdown): ExplainerRow[] {
  return [
    {
      label: "Revenu généré",
      detail: "CA HT facturé · TJM du jour",
      value: breakdown.caHtPerDay,
      tone: "neutral"
    },
    {
      label: "Frais société récupérés",
      detail: "BNC versé après CSG et frais pro",
      value: breakdown.bncPerDay,
      tone: "add"
    },
    {
      label: "Frais perso récupérés",
      detail: "NDF, IK, CESU… remboursés par la société",
      value: breakdown.personalChargesPerDay,
      tone: "add"
    },
    {
      label: "Valeur retenue finale",
      detail: "BNC + frais perso récupérés",
      value: breakdown.netPerDay,
      tone: "result"
    }
  ];
}

function ExplainerContent({
  breakdown,
  fmt,
  isCurrentMonthEstimate
}: {
  breakdown: ValeurReelleDailyBreakdown;
  fmt: Fmt;
  isCurrentMonthEstimate: boolean;
}) {
  const rows = buildExplainerRows(breakdown);
  const [revenue, business, personal, retained] = rows;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold text-ink-900 dark:text-white">Valeur retenue / jour</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-ink-500 dark:text-white/45">
          La valeur retenue mesure ce que vous récupérez réellement (rémunération + avantages), pas
          seulement le CA facturé d&apos;un jour.
        </p>
      </div>

      <dl className="space-y-1">
        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-ink-50/80 px-2.5 py-2 dark:bg-white/[0.04]">
          <div>
            <dt className="text-[11px] font-semibold text-ink-800 dark:text-white/88">{revenue.label}</dt>
            {revenue.detail ? (
              <dd className="text-[10px] text-ink-500 dark:text-white/40">{revenue.detail}</dd>
            ) : null}
          </div>
          <dd className="shrink-0 font-bold tabular-nums text-ink-900 dark:text-white">
            {fmt.euro(revenue.value)}
          </dd>
        </div>
      </dl>

      <div className="rounded-xl border border-ink-200/70 bg-white/60 px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-white/40">
          Composantes de la valeur retenue
        </p>
        <dl className="mt-1.5 space-y-1">
          {[business, personal].map((row, index) => (
            <div key={row.label}>
              {index > 0 ? (
                <div className="flex justify-center py-0.5" aria-hidden>
                  <Plus className="h-3 w-3 text-emerald-600/70 dark:text-emerald-300/60" />
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3 rounded-lg px-1 py-1">
                <div>
                  <dt className="text-[11px] font-semibold text-teal-800 dark:text-teal-200">
                    {row.label}
                  </dt>
                  {row.detail ? (
                    <dd className="text-[10px] text-ink-500 dark:text-white/40">{row.detail}</dd>
                  ) : null}
                </div>
                <dd className="shrink-0 font-bold tabular-nums text-teal-800 dark:text-teal-200">
                  {fmt.euro(row.value)}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-1.5 flex items-center justify-center" aria-hidden>
          <span className="text-[10px] font-bold text-ink-400 dark:text-white/35">=</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-emerald-500/[0.08] px-2 py-2 dark:bg-emerald-500/10">
          <div>
            <dt className="text-[11px] font-bold text-emerald-900 dark:text-emerald-100">
              {retained.label}
            </dt>
            {retained.detail ? (
              <dd className="text-[10px] text-emerald-800/80 dark:text-emerald-200/70">
                {retained.detail}
              </dd>
            ) : null}
          </div>
          <dd className="shrink-0 font-display text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
            {fmt.euro(retained.value)}
          </dd>
        </div>
      </div>

      {breakdown.netExceedsTjm ? (
        <div className="flex gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-2.5 py-2 dark:border-amber-400/25 dark:bg-amber-500/10">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
          <div className="text-[10px] leading-relaxed text-amber-950/90 dark:text-amber-100/90">
            <p className="font-bold">Pourquoi la valeur retenue dépasse le TJM ?</p>
            <p className="mt-1">
              Le TJM ({fmt.euro(breakdown.caHtPerDay)}) correspond au <strong>revenu facturé</strong>{" "}
              d&apos;une journée. La valeur retenue ({fmt.euro(breakdown.netPerDay)}) additionne la{" "}
              <strong>rémunération BNC</strong> ({fmt.euro(breakdown.bncPerDay)}) et les{" "}
              <strong>frais perso récupérés</strong> ({fmt.euro(breakdown.personalChargesPerDay)}),
              répartis sur{" "}
              {breakdown.workedDays > 0
                ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: isCurrentMonthEstimate ? 0 : 1 }).format(breakdown.workedDays)} jour${breakdown.workedDays > 1 ? "s" : ""}`
                : "la période"}
              . Ces flux ne sont pas limités au CA d&apos;un seul jour
              {isCurrentMonthEstimate && breakdown.isEstimate ? " (estimation sur historique)" : ""}.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  breakdown: ValeurReelleDailyBreakdown;
  fmt: Fmt;
  isCurrentMonthEstimate: boolean;
  /** Compact trigger beside the retained value headline. */
  variant?: "icon" | "inline-banner" | "panel";
};

export function ValeurReelleRetainedValueExplainer({
  breakdown,
  fmt,
  isCurrentMonthEstimate,
  variant = "icon"
}: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (variant === "panel") {
    return (
      <ExplainerContent
        breakdown={breakdown}
        fmt={fmt}
        isCurrentMonthEstimate={isCurrentMonthEstimate}
      />
    );
  }

  if (variant === "inline-banner" && breakdown.netExceedsTjm) {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-500/10">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="flex-1 text-[10px] leading-relaxed text-amber-950/90 dark:text-amber-100/90">
          La valeur retenue dépasse le TJM — elle inclut BNC + frais perso récupérés, pas seulement le
          CA facturé.
        </p>
        <div ref={rootRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-amber-800 underline decoration-amber-400/60 underline-offset-2 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
            aria-expanded={open}
            aria-controls={panelId}
          >
            Détail
          </button>
          {open ? (
            <div
              id={panelId}
              role="tooltip"
              className="absolute bottom-full right-0 z-30 mb-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-ink-200/90 bg-white/98 p-3.5 shadow-xl backdrop-blur-sm dark:border-cyan-100/[0.14] dark:bg-[#0b3038]/98"
            >
              <ExplainerContent
                breakdown={breakdown}
                fmt={fmt}
                isCurrentMonthEstimate={isCurrentMonthEstimate}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "inline-flex items-center justify-center rounded-lg transition",
          open
            ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
            : "text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:text-white/35 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
        )}
        aria-label="Comprendre la valeur retenue par jour"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="tooltip"
          className="absolute bottom-full right-0 z-30 mb-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-ink-200/90 bg-white/98 p-3.5 shadow-xl backdrop-blur-sm dark:border-cyan-100/[0.14] dark:bg-[#0b3038]/98"
        >
          <ExplainerContent
            breakdown={breakdown}
            fmt={fmt}
            isCurrentMonthEstimate={isCurrentMonthEstimate}
          />
        </div>
      ) : null}
    </div>
  );
}
