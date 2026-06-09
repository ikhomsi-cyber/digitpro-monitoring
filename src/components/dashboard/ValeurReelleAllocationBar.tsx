"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";

export type ValeurReelleAllocationSegment = {
  id: "retained" | "csg" | "personal" | "company";
  label: string;
  shortLabel: string;
  amountEur: number;
  percent: number;
  gradientClass: string;
  dotClass: string;
  textOnBarClass: string;
  legendTextClass: string;
};

/** Segments sum to 100 % of CA HT : retenu + CSG + frais perso + frais DigitPro. */
export function buildValeurReelleAllocationSegments(
  tree: ValeurReelleCashTree
): ValeurReelleAllocationSegment[] {
  const base = Math.max(0, tree.caFactureEur);
  const companyEur = Math.max(0, tree.mandatoryFeesEur);
  const csgEur = Math.max(0, tree.csgEur);
  const personalEur = Math.max(0, tree.personalChargesEur);
  const retainedEur = Math.max(0, base - csgEur - companyEur - personalEur);

  const pct = (amount: number) =>
    base > 0 ? Math.round((amount / base) * 1000) / 10 : 0;

  return [
    {
      id: "retained",
      label: "Valeur retenue",
      shortLabel: "Retenu",
      amountEur: retainedEur,
      percent: pct(retainedEur),
      gradientClass: "from-sky-400 to-blue-600",
      dotClass: "bg-sky-500",
      textOnBarClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
      legendTextClass: "text-sky-800 dark:text-sky-200"
    },
    {
      id: "csg",
      label: "CSG",
      shortLabel: "CSG",
      amountEur: csgEur,
      percent: pct(csgEur),
      gradientClass: "from-orange-300 to-amber-500",
      dotClass: "bg-orange-400",
      textOnBarClass: "text-ink-900/90 dark:text-ink-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]",
      legendTextClass: "text-orange-800 dark:text-orange-200"
    },
    {
      id: "personal",
      label: "Frais perso",
      shortLabel: "Perso",
      amountEur: personalEur,
      percent: pct(personalEur),
      gradientClass: "from-emerald-400 to-teal-500",
      dotClass: "bg-emerald-500",
      textOnBarClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
      legendTextClass: "text-emerald-800 dark:text-emerald-200"
    },
    {
      id: "company",
      label: "Frais DigitPro",
      shortLabel: "DigitPro",
      amountEur: companyEur,
      percent: pct(companyEur),
      gradientClass: "from-rose-400 to-rose-600",
      dotClass: "bg-rose-500",
      textOnBarClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
      legendTextClass: "text-rose-800 dark:text-rose-200"
    }
  ];
}

const INLINE_LABEL_MIN_PERCENT = 11;

type Props = {
  tree: ValeurReelleCashTree;
  fmt: { euro: (n: number) => string };
};

export function ValeurReelleAllocationBar({ tree, fmt }: Props) {
  const segments = useMemo(() => buildValeurReelleAllocationSegments(tree), [tree]);
  const visibleSegments = segments.filter((s) => s.percent > 0);
  const tinySegments = visibleSegments.filter((s) => s.percent < INLINE_LABEL_MIN_PERCENT);

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
            Répartition du CA
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">Allocation du revenu</p>
        </div>
        <div className="text-right">
          <p className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-white">
            {fmt.euro(tree.caFactureEur)}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400 dark:text-white/35">
            100 % CA HT
          </p>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-white/70 bg-ink-100 p-1 shadow-inner dark:border-cyan-100/[0.10] dark:bg-[#06242b]/70"
        role="img"
        aria-label="Répartition du chiffre d'affaires HT entre valeur retenue, CSG, frais perso et frais DigitPro"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/10 dark:from-white/10"
          aria-hidden
        />
        <div className="relative flex h-11 overflow-hidden rounded-[0.875rem] sm:h-12">
          {visibleSegments.map((segment, index) => {
            const showInline = segment.percent >= INLINE_LABEL_MIN_PERCENT;
            return (
              <motion.div
                key={segment.id}
                initial={{ width: 0, opacity: 0.6 }}
                animate={{ width: `${segment.percent}%`, opacity: 1 }}
                transition={{ duration: 0.65, delay: index * 0.06 }}
                className={clsx(
                  "group/segment relative flex h-full min-w-[3px] flex-col items-center justify-center overflow-hidden bg-gradient-to-r px-0.5",
                  segment.gradientClass
                )}
                style={{ width: `${segment.percent}%` }}
                title={`${segment.label} · ${fmt.euro(segment.amountEur)} · ${segment.percent} %`}
              >
                {showInline ? (
                  <div className={clsx("flex w-full flex-col items-center justify-center px-1 text-center", segment.textOnBarClass)}>
                    <span className="truncate text-[10px] font-bold tabular-nums leading-tight sm:text-[11px]">
                      {fmt.euro(segment.amountEur)}
                    </span>
                    <span className="text-[9px] font-semibold tabular-nums opacity-90 sm:text-[10px]">
                      {segment.percent} %
                    </span>
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </div>

      {tinySegments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-0.5">
          {tinySegments.map((segment) => (
            <span
              key={`tiny-${segment.id}`}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink-600 dark:text-white/60"
            >
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", segment.dotClass)} aria-hidden />
              <span className={segment.legendTextClass}>{segment.label}</span>
              <span className="tabular-nums text-ink-900 dark:text-white">{fmt.euro(segment.amountEur)}</span>
              <span className="tabular-nums text-ink-500 dark:text-white/45">· {segment.percent} %</span>
            </span>
          ))}
        </div>
      ) : null}

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((segment) => (
          <li
            key={`legend-${segment.id}`}
            className="min-w-0 rounded-xl border border-ink-200/70 bg-white/55 px-2.5 py-2 shadow-sm dark:border-cyan-100/[0.08] dark:bg-white/[0.04] dark:shadow-none"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={clsx("h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor]", segment.dotClass)}
                aria-hidden
              />
              <span className={clsx("truncate text-[10px] font-bold uppercase tracking-[0.06em]", segment.legendTextClass)}>
                {segment.shortLabel}
              </span>
            </div>
            <p className="mt-1 font-display text-sm font-bold tabular-nums text-ink-950 dark:text-white">
              {fmt.euro(segment.amountEur)}
            </p>
            <p className="text-[10px] font-semibold tabular-nums text-ink-500 dark:text-white/40">
              {segment.percent} %
            </p>
            <p className="mt-0.5 truncate text-[9px] font-medium text-ink-500 dark:text-white/35">{segment.label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
