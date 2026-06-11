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
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";
import { clsx } from "clsx";
import { AppSectionNav } from "@/components/AppSectionNav";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { maskMoneyAmount } from "@/lib/dummy-display-numbers";
import { useRootIsDark } from "@/lib/use-root-is-dark";
import type { LmnpAnalysis } from "@/lib/lmnp-analyze";
import { LMNP_LOYER_ANALYTIC_MONTH_AFTER_DAY } from "@/lib/lmnp-config";

function monthShortFr(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map((x) => Number(x));
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(d);
}

function formatPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${p.toFixed(2)} %`;
}

function LmnpTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number }>;
  label?: string;
}) {
  const isDark = useRootIsDark();
  const fmt = useDashboardDisplayFormat();
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
            <span>{fmt.euro(typeof p.value === "number" ? p.value : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LMNPClient({
  analysis,
  demoMode,
  loadError
}: {
  analysis: LmnpAnalysis;
  demoMode: boolean;
  loadError: string | null;
}) {
  const fmt = useDashboardDisplayFormat();
  const isDark = useRootIsDark();
  const gridStroke = isDark ? "#3f3f46" : "#e5e7eb";
  const tickFill = isDark ? "#a1a1aa" : "#86868B";

  const chartData = useMemo(
    () =>
      analysis.months.map((m) => ({
        mois: monthShortFr(m.month),
        Loyers: m.loyers,
        "Dépenses LMNP": m.depenses,
        "Net mensuel": m.net
      })),
    [analysis.months]
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour au dashboard
        </Link>
      </div>

      <header className="flex flex-col gap-2 border-b border-ink-200 pb-6 dark:border-cyan-100/[0.12]">
        <div className="flex items-start gap-3">
          <PremiumIconBadge icon={Building2} tone="sky" size="lg" className="mt-0.5" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
              LMNP — Argenteuil
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-600 dark:text-ink-300">
              Loyers : sous-catégorie <strong>Loyers Reçus</strong> / « Loyers Recus » ; prix d’achat et lignes
              d’acquisition : débits en sous-catégorie <strong>Appart Argenteuil</strong> ; autres charges : mots-clés +{" "}
              Argenteuil / LMNP (hors déjà classés Appart Argenteuil en achat).
            </p>
          </div>
        </div>
        {demoMode ? (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Mode démo : données fictives — aucun LMNP réel à attendre.
          </p>
        ) : null}
        {loadError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
            Erreur chargement transactions : {loadError}
          </p>
        ) : null}
      </header>

      <AppSectionNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="solid" className="border-emerald-200/80 dark:border-emerald-900/50">
          <CardBody className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">
              Loyers reçus (sous-cat. Loyers Reçus)
            </p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
              {fmt.euro(analysis.totalLoyers)}
            </p>
            {analysis.totalAchatAbsolu > 0 ? (
              <p className="mt-1.5 text-[10px] leading-snug text-ink-500 dark:text-ink-400">
                Achat constaté depuis la date d’achat (sous-cat. Appart Argenteuil) :{" "}
                <span className="font-semibold tabular-nums text-ink-700 dark:text-ink-200">
                  {fmt.euro(-analysis.totalAchatAbsolu)}
                </span>
              </p>
            ) : null}
          </CardBody>
        </Card>
        <Card variant="solid" className="border-rose-200/80 dark:border-rose-900/50">
          <CardBody className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-800/80 dark:text-rose-300/90">
              Dépenses LMNP
            </p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-rose-900 dark:text-rose-200">
              {fmt.euro(analysis.totalDepenses)}
            </p>
          </CardBody>
        </Card>
        <Card variant="solid" className="border-sky-200/80 dark:border-sky-900/50">
          <CardBody className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800/80 dark:text-sky-300/90">
              Revenu net (cash)
            </p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-sky-900 dark:text-sky-200">
              {fmt.euro(analysis.revenuNet)}
            </p>
          </CardBody>
        </Card>
        <Card variant="solid" className="border-violet-200/80 dark:border-violet-900/50">
          <CardBody className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/80 dark:text-violet-300/90">
              Renta. nette / achat
            </p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-violet-900 dark:text-violet-200">
              {formatPct(analysis.rentabiliteNettePct)}
            </p>
            <p className="mt-1 text-[10px] text-ink-500 dark:text-ink-400">Brut : {formatPct(analysis.rentabiliteBrutePct)}</p>
          </CardBody>
        </Card>
      </div>

      <Card variant="solid" className="border-ink-200/90 dark:border-cyan-100/[0.12]">
        <CardHeader className="border-b border-ink-100 pb-3 dark:border-cyan-100/[0.08]">
          <CardTitle className="text-base">Paramètres pris en compte</CardTitle>
          <p className="mt-1 text-xs text-ink-600 dark:text-ink-400">
            Achat le <span className="font-medium">{analysis.purchaseDateIso}</span> · Prix (somme débits « Appart
            Argenteuil », toutes périodes chargées) :{" "}
            {analysis.purchasePriceEur > 0 ? fmt.euro(analysis.purchasePriceEur) : "aucune ligne (0 €)"} ·
            Possession ≈ {analysis.anneesPossession.toFixed(2)} an(s) · Loyers annualisés :{" "}
            {analysis.loyersAnnualises != null ? fmt.euro(analysis.loyersAnnualises) : "—"} · Net annualisé :{" "}
            {analysis.netAnnualise != null ? fmt.euro(analysis.netAnnualise) : "—"}
          </p>
        </CardHeader>
        <CardBody className="pt-4 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          <p>
            Les <strong>loyers reçus</strong> sont les encaissements positifs dont la sous-catégorie Bankin correspond à{" "}
            <strong>Loyers Reçus</strong> / « Loyers Recus » (voir{" "}
            <code className="rounded bg-ink-100 px-1 text-xs dark:bg-white/[0.06]">LMNP_LOYERS_RECUS_MARKERS</code>
            ). Pour les <strong>graphiques et totaux par mois</strong>, un loyer encaissé après le jour{" "}
            {LMNP_LOYER_ANALYTIC_MONTH_AFTER_DAY} est rattaché au <strong>mois suivant</strong> (voir{" "}
            <code className="rounded bg-ink-100 px-1 text-xs dark:bg-white/[0.06]">effectiveLmnpLoyerAnalyticMonthKey</code>
            ). L’<strong>achat</strong> (prix + lignes du tableau) : débits en sous-catégorie{" "}
            <strong>Appart Argenteuil</strong> (voir{" "}
            <code className="rounded bg-ink-100 px-1 text-xs dark:bg-white/[0.06]">LMNP_APPART_ARGENTEUIL_MARKERS</code>
            ). Les <strong>autres dépenses</strong> LMNP restent basées sur charges typiques + Argenteuil / LMNP ; les
            débits déjà en « Appart Argenteuil » sont comptés comme achat, pas comme charges.
          </p>
          {analysis.purchasePriceEur <= 0 ? (
            <p className="mt-2 font-medium text-amber-800 dark:text-amber-200">
              Aucun débit en « Appart Argenteuil » : classez les paiements d’acquisition dans cette sous-catégorie
              Bankin pour calculer le prix et les rendements en %.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {chartData.length > 0 ? (
        <Card variant="solid" className="border-ink-200/90 dark:border-cyan-100/[0.12]">
          <CardHeader className="border-b border-ink-100 pb-3 dark:border-cyan-100/[0.08]">
            <CardTitle className="text-base">Loyers vs dépenses par mois</CardTitle>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Loyers : jour bancaire <strong>strictement après le {LMNP_LOYER_ANALYTIC_MONTH_AFTER_DAY}</strong> du mois
              → affectés au <strong>mois civil suivant</strong> dans ce graphique (aligné règle CA du dashboard). Les
              tableaux conservent la date de transaction.
            </p>
          </CardHeader>
          <CardBody className="pt-4">
            <div className="h-72 w-full" data-private role="img" aria-label="Graphique LMNP mensuel">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="mois" tick={{ fill: tickFill, fontSize: 10 }} minTickGap={8} />
                  <YAxis
                    tick={{ fill: tickFill, fontSize: 10 }}
                    width={44}
                    tickFormatter={(v) =>
                      `${Math.round((typeof v === "number" && fmt.dummy ? maskMoneyAmount(v) : Number(v)) / 1000)}k`
                    }
                  />
                  <Tooltip content={<LmnpTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Loyers" fill="#059669" maxBarSize={32} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dépenses LMNP" fill="#e11d48" maxBarSize={32} radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="Net mensuel"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#38bdf8" }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="solid" className="min-h-0 border-ink-200/90 dark:border-cyan-100/[0.12] lg:col-span-2">
          <CardHeader className="border-b border-ink-100 pb-3 dark:border-cyan-100/[0.08]">
            <CardTitle className="text-base">
              Depuis l’achat — loyers (« Loyers Reçus ») & achat (« Appart Argenteuil ») (
              {(analysis.loyersRecusTx.length + analysis.achatAppartTx.length).toString()} mouvement
              {analysis.loyersRecusTx.length + analysis.achatAppartTx.length !== 1 ? "s" : ""})
            </CardTitle>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Loyers reçus : {analysis.loyersRecusTx.length} · Achat appartement : {analysis.achatAppartTx.length}
            </p>
          </CardHeader>
          <CardBody className="max-h-[min(28rem,70vh)] space-y-6 overflow-y-auto pt-4">
            {analysis.loyersRecusTx.length === 0 && analysis.achatAppartTx.length === 0 ? (
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Aucune opération : pour les loyers, utilisez la sous-catégorie « Loyers Reçus » / « Loyers Recus » ; pour
                l’achat, sous-catégorie « Appart Argenteuil ».
              </p>
            ) : (
              <>
                {analysis.loyersRecusTx.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      Loyers reçus
                    </p>
                    <table className="mt-2 w-full text-left text-xs">
                      <thead className="text-[10px] uppercase text-ink-500 dark:text-ink-400">
                        <tr>
                          <th className="py-1 pr-2">Date</th>
                          <th className="py-1">Libellé</th>
                          <th className="py-1">Catégorie</th>
                          <th className="py-1 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.loyersRecusTx.map((t) => (
                          <tr key={t.id} className="border-t border-ink-100 dark:border-cyan-100/[0.08]">
                            <td className="py-1.5 pr-2 tabular-nums text-ink-600 dark:text-ink-400">{t.date}</td>
                            <td className="max-w-[10rem] truncate py-1.5 text-ink-800 dark:text-ink-100" title={t.label}>
                              {t.label}
                            </td>
                            <td className="max-w-[10rem] truncate py-1.5 text-ink-500 dark:text-ink-400" title={t.category}>
                              {t.category}
                            </td>
                            <td className="py-1.5 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                              {fmt.euro(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {analysis.achatAppartTx.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      Achat appartement (Argenteuil)
                    </p>
                    <table className="mt-2 w-full text-left text-xs">
                      <thead className="text-[10px] uppercase text-ink-500 dark:text-ink-400">
                        <tr>
                          <th className="py-1 pr-2">Date</th>
                          <th className="py-1">Libellé</th>
                          <th className="py-1">Catégorie</th>
                          <th className="py-1 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.achatAppartTx.map((t) => (
                          <tr key={t.id} className="border-t border-ink-100 dark:border-cyan-100/[0.08]">
                            <td className="py-1.5 pr-2 tabular-nums text-ink-600 dark:text-ink-400">{t.date}</td>
                            <td className="max-w-[10rem] truncate py-1.5 text-ink-800 dark:text-ink-100" title={t.label}>
                              {t.label}
                            </td>
                            <td className="max-w-[10rem] truncate py-1.5 text-ink-500 dark:text-ink-400" title={t.category}>
                              {t.category}
                            </td>
                            <td className="py-1.5 text-right font-medium tabular-nums text-amber-800 dark:text-amber-200">
                              {fmt.euro(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>

        <Card variant="solid" className="min-h-0 border-ink-200/90 dark:border-cyan-100/[0.12] lg:col-span-2">
          <CardHeader className="border-b border-ink-100 pb-3 dark:border-cyan-100/[0.08]">
            <CardTitle className="text-base">Autres dépenses LMNP ({analysis.depensesTx.length})</CardTitle>
          </CardHeader>
          <CardBody className="max-h-80 overflow-y-auto pt-3">
            {analysis.depensesTx.length === 0 ? (
              <p className="text-sm text-ink-500 dark:text-ink-400">Aucune dépense détectée.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-[10px] uppercase text-ink-500 dark:bg-ink-950 dark:text-ink-400">
                  <tr>
                    <th className="py-1 pr-2">Date</th>
                    <th className="py-1">Libellé</th>
                    <th className="py-1 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.depensesTx.map((t) => (
                    <tr key={t.id} className="border-t border-ink-100 dark:border-cyan-100/[0.08]">
                      <td className="py-1.5 pr-2 tabular-nums text-ink-600 dark:text-ink-400">{t.date}</td>
                      <td className="max-w-[12rem] truncate py-1.5 text-ink-800 dark:text-ink-100" title={t.label}>
                        {t.label}
                      </td>
                      <td className="py-1.5 text-right font-medium tabular-nums text-rose-700 dark:text-rose-300">
                        {fmt.euro(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
