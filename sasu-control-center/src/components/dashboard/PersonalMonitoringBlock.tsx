"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Scale } from "lucide-react";
import { clsx } from "clsx";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatEur } from "@/lib/format";
import { useRootIsDark } from "@/lib/use-root-is-dark";
import {
  computeDashboardMonthlyMetrics,
  countsTowardPersonalExpenseKpi,
  countsTowardPersonalRevenueKpi,
  type DashboardTx
} from "@/lib/dashboard-metrics";

function monthShortFr(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(d);
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function dashboardMonthKeyNowLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function aggregatePersonalMonth(txs: readonly DashboardTx[], monthKey: string): {
  revenue: number;
  expenses: number;
} {
  let revenue = 0;
  let expenses = 0;
  for (const t of txs) {
    if (t.date.slice(0, 7) !== monthKey) continue;
    if (countsTowardPersonalRevenueKpi(t)) revenue += t.amount;
    if (countsTowardPersonalExpenseKpi(t)) expenses += Math.abs(t.amount);
  }
  return { revenue, expenses };
}

function aggregatePersonalYtd(txs: readonly DashboardTx[], now = new Date()): {
  revenue: number;
  expenses: number;
} {
  const y = now.getFullYear();
  const prefix = `${y}-`;
  const cap = localYmd(now);
  let revenue = 0;
  let expenses = 0;
  for (const t of txs) {
    if (!t.date.startsWith(prefix)) continue;
    if (t.date > cap) continue;
    if (countsTowardPersonalRevenueKpi(t)) revenue += t.amount;
    if (countsTowardPersonalExpenseKpi(t)) expenses += Math.abs(t.amount);
  }
  return { revenue, expenses };
}

function formatCompactAxisEur(v: number): string {
  const n = Math.abs(v);
  if (n >= 10_000) return `${Math.round(v / 1000)}k`;
  if (n >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v));
}

function PersonalFlowTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  const isDark = useRootIsDark();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={clsx(
        "rounded-lg border px-2.5 py-2 text-xs shadow-card ring-1",
        isDark
          ? "border-ink-600 bg-ink-900 text-ink-100 ring-white/10"
          : "border-ink-200 bg-white ring-black/[0.04]"
      )}
    >
      <div className="font-medium">{label}</div>
      <ul className="mt-1 space-y-0.5 tabular-nums">
        {payload.map((p) => (
          <li key={String(p.name)} className="flex justify-between gap-4">
            <span className="text-ink-500 dark:text-ink-400">{p.name}</span>
            <span>{formatEur(typeof p.value === "number" ? p.value : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildNarrative(params: {
  monthRev: number;
  monthExp: number;
  avgHistExp: number | null;
  histMonthCount: number;
}): string {
  const { monthRev, monthExp, avgHistExp, histMonthCount } = params;
  const net = monthRev - monthExp;
  const sentences: string[] = [];

  if (histMonthCount >= 2 && avgHistExp != null && avgHistExp > 0) {
    const deltaPct = ((monthExp - avgHistExp) / avgHistExp) * 100;
    if (deltaPct >= 5) {
      sentences.push(
        `Les sorties du mois en cours dépassent d’environ ${Math.round(deltaPct)} % la moyenne des ${histMonthCount} mois civils précédents (${formatEur(avgHistExp)} / mois en moyenne).`
      );
    } else if (deltaPct <= -5) {
      sentences.push(
        `Les sorties du mois en cours restent d’environ ${Math.round(-deltaPct)} % sous la moyenne des ${histMonthCount} mois précédents (${formatEur(avgHistExp)} / mois).`
      );
    } else {
      sentences.push(
        `Les sorties du mois sont proches de votre moyenne récente (${formatEur(avgHistExp)} sur ${histMonthCount} mois).`
      );
    }
  } else if (histMonthCount === 1 && avgHistExp != null) {
    sentences.push(
      `Avec un seul mois d’historique complet avant le mois en cours (${formatEur(avgHistExp)}), la comparaison sera plus fiable au fil des mois.`
    );
  } else {
    sentences.push(
      "Peu de mois complets avant le mois en cours : la comparaison à l’historique gagnera en pertinence avec plus de données."
    );
  }

  if (net >= 0) {
    sentences.push(`Flux net du mois (entrées − sorties) : +${formatEur(net)}.`);
  } else {
    sentences.push(
      `Flux net du mois (entrées − sorties) : ${formatEur(net)} — les sorties dépassent les entrées sur la période.`
    );
  }

  return sentences.join(" ");
}

export function PersonalMonitoringBlock({
  transactionsWindow,
  personalTransactionsFull,
  selectedYears
}: {
  /** Fenêtre d’analyse (12 mois glissants ou années sélectionnées), périmètre perso uniquement. */
  transactionsWindow: DashboardTx[];
  /** Toutes les transactions perso (hors filtre glissant), pour mois en cours / YTD calendaire. */
  personalTransactionsFull: DashboardTx[];
  selectedYears: number[] | null;
}) {
  const monthKeyNow = dashboardMonthKeyNowLocal();
  const calendarYear = Number(monthKeyNow.slice(0, 4));
  const todayLabel = localYmd(new Date());

  const metrics = useMemo(
    () =>
      computeDashboardMonthlyMetrics(transactionsWindow, {
        years: selectedYears,
        kpiMode: "personal"
      }),
    [transactionsWindow, selectedYears]
  );

  const monthNowFromMetrics = useMemo(
    () => metrics.find((m) => m.month === monthKeyNow),
    [metrics, monthKeyNow]
  );

  const monthNowTotals = useMemo(() => {
    if (monthNowFromMetrics) return monthNowFromMetrics;
    const agg = aggregatePersonalMonth(personalTransactionsFull, monthKeyNow);
    return { month: monthKeyNow, revenue: agg.revenue, expenses: agg.expenses };
  }, [monthNowFromMetrics, personalTransactionsFull, monthKeyNow]);

  const ytdTotals = useMemo(
    () => aggregatePersonalYtd(personalTransactionsFull, new Date()),
    [personalTransactionsFull]
  );

  const ytdNet = ytdTotals.revenue - ytdTotals.expenses;

  const historicalStats = useMemo(() => {
    const past = metrics.filter((m) => m.month < monthKeyNow);
    if (!past.length) return { avgExp: null as number | null, avgRev: null as number | null, n: 0 };
    const sumE = past.reduce((s, x) => s + x.expenses, 0);
    const sumR = past.reduce((s, x) => s + x.revenue, 0);
    return {
      avgExp: sumE / past.length,
      avgRev: sumR / past.length,
      n: past.length
    };
  }, [metrics, monthKeyNow]);

  const narrative = useMemo(
    () =>
      buildNarrative({
        monthRev: monthNowTotals.revenue,
        monthExp: monthNowTotals.expenses,
        avgHistExp: historicalStats.avgExp,
        histMonthCount: historicalStats.n
      }),
    [monthNowTotals, historicalStats]
  );

  const chartData = useMemo(
    () =>
      metrics.map((m) => ({
        key: m.month,
        mois: monthShortFr(m.month),
        Entrées: m.revenue,
        Sorties: m.expenses,
        /** Flux net mensuel (entrées − sorties), affiché en courbe « Épargne ». */
        Épargne: m.revenue - m.expenses
      })),
    [metrics]
  );

  const isDark = useRootIsDark();
  const gridStroke = isDark ? "#3f3f46" : "#e5e7eb";
  const tickFill = isDark ? "#a1a1aa" : "#86868B";

  const monthNet = monthNowTotals.revenue - monthNowTotals.expenses;

  return (
    <Card
      variant="solid"
      className="overflow-hidden border-ink-200/90 bg-white shadow-sm dark:border-ink-700 dark:bg-gradient-to-b dark:from-ink-950 dark:to-ink-900 dark:shadow-none"
    >
      <CardHeader className="border-b border-ink-100/80 bg-gradient-to-b from-violet-50/80 to-white pb-3 dark:border-ink-800 dark:from-ink-900/95 dark:to-ink-950">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-200/70 bg-violet-50/90 text-violet-700 shadow-sm dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-300 dark:shadow-none"
            aria-hidden
          >
            <Scale className="h-4 w-4" strokeWidth={1.85} />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="!mt-0 text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50">
              Personal Monitoring
            </CardTitle>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400 sm:text-xs">
              Comparaison entrées / sorties par mois, épargne nette (entrées − sorties) en courbe (hors virements
              internes), résumé du mois civil en cours et depuis le 1er janvier, lecture par rapport à l’historique
              dans la fenêtre d’analyse.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              Mois en cours ({monthKeyNow})
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-2.5 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="text-[9px] font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">
                  Entrées
                </p>
                <p className="mt-1 font-display text-sm font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                  {formatEur(monthNowTotals.revenue)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 px-2.5 py-2 dark:border-rose-900/50 dark:bg-rose-950/30">
                <p className="text-[9px] font-medium uppercase tracking-wide text-rose-800/80 dark:text-rose-300/90">
                  Sorties
                </p>
                <p className="mt-1 font-display text-sm font-bold tabular-nums text-rose-900 dark:text-rose-200">
                  {formatEur(monthNowTotals.expenses)}
                </p>
              </div>
              <div
                className={clsx(
                  "rounded-xl border px-2.5 py-2",
                  monthNet >= 0
                    ? "border-sky-200/70 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/30"
                    : "border-amber-200/70 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/30"
                )}
              >
                <p className="text-[9px] font-medium uppercase tracking-wide text-ink-600 dark:text-ink-300">
                  Net
                </p>
                <p
                  className={clsx(
                    "mt-1 font-display text-sm font-bold tabular-nums",
                    monthNet >= 0
                      ? "text-sky-900 dark:text-sky-200"
                      : "text-amber-900 dark:text-amber-200"
                  )}
                >
                  {monthNet >= 0 ? "+" : ""}
                  {formatEur(monthNet)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              Depuis le 1er janvier {calendarYear} (cumul au {todayLabel})
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-2.5 py-2 dark:border-emerald-900/45 dark:bg-emerald-950/25">
                <p className="text-[9px] font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">
                  Entrées YTD
                </p>
                <p className="mt-1 font-display text-sm font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                  {formatEur(ytdTotals.revenue)}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200/70 bg-rose-50/40 px-2.5 py-2 dark:border-rose-900/45 dark:bg-rose-950/25">
                <p className="text-[9px] font-medium uppercase tracking-wide text-rose-800/80 dark:text-rose-300/90">
                  Sorties YTD
                </p>
                <p className="mt-1 font-display text-sm font-bold tabular-nums text-rose-900 dark:text-rose-200">
                  {formatEur(ytdTotals.expenses)}
                </p>
              </div>
              <div
                className={clsx(
                  "rounded-xl border px-2.5 py-2",
                  ytdNet >= 0
                    ? "border-sky-200/70 bg-sky-50/40 dark:border-sky-900/45 dark:bg-sky-950/25"
                    : "border-amber-200/70 bg-amber-50/40 dark:border-amber-900/45 dark:bg-amber-950/25"
                )}
              >
                <p className="text-[9px] font-medium uppercase tracking-wide text-ink-600 dark:text-ink-300">
                  Net YTD
                </p>
                <p
                  className={clsx(
                    "mt-1 font-display text-sm font-bold tabular-nums",
                    ytdNet >= 0 ? "text-sky-900 dark:text-sky-200" : "text-amber-900 dark:text-amber-200"
                  )}
                >
                  {ytdNet >= 0 ? "+" : ""}
                  {formatEur(ytdNet)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-5 dark:border-ink-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Entrées, sorties et épargne nette par mois
          </p>
          {chartData.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
              Aucune transaction privée sur la période sélectionnée.
            </p>
          ) : (
            <div
              className="mt-3 h-64 w-full"
              data-private
              role="img"
              aria-label="Histogramme entrées, sorties et courbe d’épargne nette"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={10} />
                  <YAxis
                    tick={{ fill: tickFill, fontSize: 10 }}
                    width={40}
                    tickFormatter={formatCompactAxisEur}
                  />
                  <Tooltip
                    content={<PersonalFlowTooltip />}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => <span className="text-ink-600 dark:text-ink-300">{v}</span>}
                  />
                  <Bar dataKey="Entrées" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Sorties" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line
                    type="monotone"
                    dataKey="Épargne"
                    name="Épargne"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#38bdf8", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-ink-200/80 bg-ink-50/50 p-3.5 text-sm leading-relaxed text-ink-700 dark:border-ink-700 dark:bg-ink-950/40 dark:text-ink-200">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Synthèse vs historique
          </p>
          <p className="mt-2 text-[13px]">{narrative}</p>
          {historicalStats.avgRev != null && historicalStats.n > 0 ? (
            <p className="mt-2 text-[12px] text-ink-500 dark:text-ink-400">
              Moyenne des entrées sur les {historicalStats.n} mois précédents : {formatEur(historicalStats.avgRev)}{" "}
              / mois (indicatif, même fenêtre que le graphique).
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
