"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { BncYearAreaChart } from "@/components/dashboard/BncYearAreaChart";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { transactionAnalyticsDayIso, type DashboardTx } from "@/lib/dashboard-metrics";

type BncPayment = {
  kind: PaymentKind;
  amountEur: number;
  monthKey: string;
  year: number;
};

type PaymentKind = "bnc" | "ik" | "ndf";

const PAYMENT_KINDS: Array<{
  id: PaymentKind;
  label: string;
  dotClassName: string;
}> = [
  { id: "bnc", label: "BNC", dotClassName: "bg-emerald-500 dark:bg-emerald-400" },
  { id: "ik", label: "IK", dotClassName: "bg-sky-500 dark:bg-sky-400" },
  { id: "ndf", label: "NDF", dotClassName: "bg-amber-500 dark:bg-amber-400" }
];

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fév",
  "Mars",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc"
] as const;

function fold(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function resolvePaymentKind(tx: DashboardTx): PaymentKind | null {
  if ((tx.scope ?? "pro") !== "pro" || tx.amount >= 0) return null;
  const bucket = deriveExpenseBucket(tx);
  const blob = fold(`${tx.label} ${tx.category}`);

  if (bucket === "BNC" || /\bbnc\b/.test(blob)) return "bnc";
  if (
    bucket === "NDF" ||
    bucket === "Repas d'affaire" ||
    blob.includes("note de frais") ||
    blob.includes("notes de frais") ||
    /\bndf\b/.test(blob)
  ) {
    return "ndf";
  }
  if (
    bucket === "Indemnités kilométriques" ||
    blob.includes("indemnites kilometriques") ||
    blob.includes("frais kilometriques") ||
    /\bik\b/.test(blob)
  ) {
    return "ik";
  }
  return null;
}

export function BncPaymentHistoryCard({ transactions }: { transactions: DashboardTx[] }) {
  const fmt = useDashboardDisplayFormat();
  const now = useMemo(() => new Date(), []);
  const payments = useMemo<BncPayment[]>(
    () =>
      transactions
        .map((tx) => {
          const kind = resolvePaymentKind(tx);
          if (!kind) return null;
          const date = transactionAnalyticsDayIso(tx);
          return {
            kind,
            amountEur: Math.abs(tx.amount),
            monthKey: date.slice(0, 7),
            year: Number(date.slice(0, 4))
          };
        })
        .filter((payment): payment is BncPayment => payment != null)
        .filter((payment) => Number.isFinite(payment.year))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    [transactions]
  );

  const years = useMemo(() => {
    const set = new Set(payments.map((payment) => payment.year));
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [now, payments]);

  const [selectedYear, setSelectedYear] = useState(() => years[0] ?? now.getFullYear());
  const effectiveYear = years.includes(selectedYear) ? selectedYear : years[0] ?? now.getFullYear();

  const { monthly, totalsByKind, totalEur } = useMemo(() => {
    const maxMonth0 = effectiveYear === now.getFullYear() ? now.getMonth() : 11;
    const byMonth = new Map<string, Record<PaymentKind, number>>();
    const byKind: Record<PaymentKind, number> = { bnc: 0, ik: 0, ndf: 0 };
    for (let m0 = 0; m0 <= maxMonth0; m0++) {
      byMonth.set(`${effectiveYear}-${String(m0 + 1).padStart(2, "0")}`, { bnc: 0, ik: 0, ndf: 0 });
    }

    const rows = payments.filter((payment) => payment.year === effectiveYear);
    for (const payment of rows) {
      const monthValues = byMonth.get(payment.monthKey) ?? { bnc: 0, ik: 0, ndf: 0 };
      monthValues[payment.kind] = Math.round((monthValues[payment.kind] + payment.amountEur) * 100) / 100;
      byMonth.set(payment.monthKey, monthValues);
      byKind[payment.kind] = Math.round((byKind[payment.kind] + payment.amountEur) * 100) / 100;
    }

    const monthlyRows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        monthLabel: MONTH_LABELS_SHORT[Number(month.slice(5, 7)) - 1] ?? month.slice(5, 7),
        bncEur: Math.round(values.bnc * 100) / 100,
        ikEur: Math.round(values.ik * 100) / 100,
        ndfEur: Math.round(values.ndf * 100) / 100
      }));

    const total = Math.round(rows.reduce((sum, payment) => sum + payment.amountEur, 0) * 100) / 100;
    return {
      monthly: monthlyRows,
      totalsByKind: byKind,
      totalEur: total
    };
  }, [effectiveYear, now, payments]);

  return (
    <section className={dashboardInsightCard}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink-500 dark:text-white/50">Historique versements BNC · IK · NDF</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900 dark:text-white">
              {fmt.euro(totalEur)}
            </p>
            <span className="text-xs font-medium tabular-nums text-ink-500 dark:text-white/45">
              {effectiveYear}
            </span>
          </div>
        </div>

        {years.length > 1 ? (
          <div className="inline-flex max-w-full rounded-full border border-ink-200/70 bg-ink-50/80 p-0.5 dark:border-white/[0.1] dark:bg-white/[0.05]">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                aria-pressed={effectiveYear === year}
                onClick={() => setSelectedYear(year)}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums transition",
                  effectiveYear === year
                    ? "bg-white text-ink-900 shadow-sm dark:bg-white/[0.18] dark:text-white"
                    : "text-ink-500 hover:text-ink-800 dark:text-white/45 dark:hover:text-white/75"
                )}
              >
                {year}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {PAYMENT_KINDS.map((kind) => (
          <li key={kind.id} className="inline-flex items-center gap-1.5 text-ink-600 dark:text-white/60">
            <span className={clsx("h-2 w-2 shrink-0 rounded-full", kind.dotClassName)} aria-hidden />
            <span>{kind.label}</span>
            <span className="font-medium tabular-nums text-ink-800 dark:text-white/85">
              {fmt.euro(totalsByKind[kind.id])}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <BncYearAreaChart monthly={monthly} formatEuro={fmt.euro} />
      </div>
    </section>
  );
}
