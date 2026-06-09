"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { Coins } from "lucide-react";
import type { ValeurReelleCashTree } from "@/lib/valeur-reelle-analyze";

export type ValeurReellePer100Segment = {
  id: "retained" | "csg" | "personal" | "other";
  label: string;
  shortLabel: string;
  amountEur: number;
  percent: number;
  gradientClass: string;
  dotClass: string;
  textOnBarClass: string;
  legendTextClass: string;
  detail: string;
};

/**
 * Per 100 € HT invoiced — segments sum to 100 €:
 * - Retenu = net disponible réel (BNC + frais perso récupérés)
 * - CSG, frais perso (part du CA), Autres = reliquat (frais DigitPro & co.)
 */
export function buildValeurReellePer100Segments(tree: ValeurReelleCashTree): ValeurReellePer100Segment[] {
  const caHt = Math.max(0, tree.caFactureEur);
  const toPer100 = (amount: number) => (caHt > 0 ? Math.round((amount / caHt) * 100) : 0);

  const netDisponibleReel = tree.bncEur + tree.personalChargesEur;
  const retained = toPer100(netDisponibleReel);
  const csg = toPer100(tree.csgEur);
  const personal = toPer100(tree.personalChargesEur);
  const other = Math.max(0, 100 - retained - csg - personal);

  return [
    {
      id: "retained",
      label: "Valeur retenue",
      shortLabel: "Retenu",
      amountEur: retained,
      percent: retained,
      gradientClass: "from-sky-400 to-blue-600",
      dotClass: "bg-sky-500",
      textOnBarClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
      legendTextClass: "text-sky-800 dark:text-sky-200",
      detail: "BNC + frais perso récupérés (net disponible réel)"
    },
    {
      id: "csg",
      label: "CSG",
      shortLabel: "CSG",
      amountEur: csg,
      percent: csg,
      gradientClass: "from-orange-300 to-amber-500",
      dotClass: "bg-orange-400",
      textOnBarClass: "text-ink-900/90 dark:text-ink-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]",
      legendTextClass: "text-orange-800 dark:text-orange-200",
      detail: "Cotisations sociales provisionnées"
    },
    {
      id: "personal",
      label: "Frais perso",
      shortLabel: "Perso",
      amountEur: personal,
      percent: personal,
      gradientClass: "from-emerald-400 to-teal-500",
      dotClass: "bg-emerald-500",
      textOnBarClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
      legendTextClass: "text-emerald-800 dark:text-emerald-200",
      detail: "Charges personnelles refacturées sur l'activité"
    },
    {
      id: "other",
      label: "Autres",
      shortLabel: "Autres",
      amountEur: other,
      percent: other,
      gradientClass: "from-rose-400 to-rose-600",
      dotClass: "bg-rose-500",
      textOnBarClass: "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]",
      legendTextClass: "text-rose-800 dark:text-rose-200",
      detail: "Frais DigitPro et charges société (reliquat)"
    }
  ];
}

const INLINE_LABEL_MIN_PERCENT = 10;

type Props = {
  tree: ValeurReelleCashTree;
  fmt: { euro: (n: number) => string };
};

function formatPer100Eur(amount: number, fmt: Props["fmt"]): string {
  return fmt.euro(amount).replace(/\s*€$/, " €");
}

export function ValeurReellePer100AllocationCard({ tree, fmt }: Props) {
  const segments = useMemo(() => buildValeurReellePer100Segments(tree), [tree]);
  const hasData = tree.caFactureEur > 0;
  const visibleSegments = segments.filter((s) => s.percent > 0);
  const tinySegments = visibleSegments.filter((s) => s.percent < INLINE_LABEL_MIN_PERCENT);

  if (!hasData) {
    return (
      <section className="rounded-[2rem] border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-sky-50/25 p-4 shadow-sm dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
        <p className="text-sm font-semibold text-ink-500 dark:text-white/45">
          Aucun CA HT sur cette période — répartition par 100 € indisponible.
        </p>
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-[2rem] border border-ink-200/90 bg-gradient-to-br from-ink-50/80 via-white to-sky-50/25 p-4 shadow-sm dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5"
      aria-labelledby="valeur-per-100-title"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500 dark:text-white/45">
            Allocation de valeur
          </p>
          <h2
            id="valeur-per-100-title"
            className="mt-1 font-display text-lg font-bold tracking-tight text-ink-950 dark:text-white sm:text-xl"
          >
            Pour 100 € facturés
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-ink-500 dark:text-white/40">
            Base HT · échelle {fmt.euro(tree.caFactureEur)} → 100 €
          </p>
        </div>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 text-sky-600 dark:border-sky-300/20 dark:bg-sky-500/12 dark:text-sky-300"
          aria-hidden
        >
          <Coins className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-white/70 bg-ink-100 p-1 shadow-inner dark:border-cyan-100/[0.10] dark:bg-[#06242b]/70"
        role="img"
        aria-label="Répartition pour 100 euros facturés HT entre valeur retenue, CSG, frais perso et autres charges"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/10 dark:from-white/10"
          aria-hidden
        />
        <div className="relative flex h-12 overflow-hidden rounded-[0.875rem] sm:h-14">
          {visibleSegments.map((segment, index) => {
            const showInline = segment.percent >= INLINE_LABEL_MIN_PERCENT;
            return (
              <motion.div
                key={segment.id}
                initial={{ width: 0, opacity: 0.65 }}
                animate={{ width: `${segment.percent}%`, opacity: 1 }}
                transition={{ duration: 0.65, delay: index * 0.07 }}
                className={clsx(
                  "group/segment relative flex h-full min-w-[3px] flex-col items-center justify-center overflow-hidden bg-gradient-to-r",
                  segment.gradientClass
                )}
                style={{ width: `${segment.percent}%` }}
                title={`${segment.label} · ${formatPer100Eur(segment.amountEur, fmt)} · ${segment.percent} %`}
              >
                {showInline ? (
                  <div
                    className={clsx(
                      "flex w-full flex-col items-center justify-center px-1 text-center",
                      segment.textOnBarClass
                    )}
                  >
                    <span className="truncate text-[11px] font-bold tabular-nums leading-tight sm:text-xs">
                      {formatPer100Eur(segment.amountEur, fmt)}
                    </span>
                    <span className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] opacity-95 sm:text-[10px]">
                      {segment.shortLabel}
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
              <span className="tabular-nums text-ink-900 dark:text-white">
                {formatPer100Eur(segment.amountEur, fmt)}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {segments.map((segment) => (
          <li
            key={`legend-${segment.id}`}
            className="min-w-0 rounded-xl border border-ink-200/70 bg-white/55 px-2.5 py-2 shadow-sm dark:border-cyan-100/[0.08] dark:bg-white/[0.04] dark:shadow-none"
            title={segment.detail}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={clsx("h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor]", segment.dotClass)}
                aria-hidden
              />
              <span
                className={clsx(
                  "truncate text-[10px] font-bold uppercase tracking-[0.06em]",
                  segment.legendTextClass
                )}
              >
                {segment.shortLabel}
              </span>
            </div>
            <p className="mt-1 font-display text-base font-bold tabular-nums text-ink-950 dark:text-white sm:text-lg">
              {formatPer100Eur(segment.amountEur, fmt)}
            </p>
            <p className="text-[10px] font-semibold tabular-nums text-ink-500 dark:text-white/40">
              {segment.percent} % du CA
            </p>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
