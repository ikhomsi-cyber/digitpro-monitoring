"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mail, Navigation, Upload, ChevronRight, ChevronLeft, House, CarFront, ReceiptText, ShoppingBasket, Layers } from "lucide-react";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import { toast } from "sonner";
import { piloteIncomeFamily, buildPiloteYear, buildPiloteCompensations, piloteCompensationFamily, type PiloteMonth, type PiloteCompensation, type BankinPiloteSnapshot } from "@/lib/pilote";
import { getGmailConnectionStatus, getGmailConnectUrl } from "@/app/dashboard/gmail-actions";
import { importBankinPersonalXlsx } from "@/app/dashboard/actions";
import { useDashboardSection } from "./DashboardSectionContext";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";

const monthName = (month: string, short = false) => new Intl.DateTimeFormat("fr-FR", { month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const FAMILY_ICONS = { rent: House, transport: CarFront, ndf: ReceiptText, food: ShoppingBasket, other: Layers };
const COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#60a5fa"];

function PiloteFamilyBars({ families, direction }: { families: PiloteCompensation[]; direction: "income" | "expenses" }) {
  const fmt = useDashboardDisplayFormat();
  const max = Math.max(1, ...families.map(family => family[direction]));
  return <div className="mt-4 flex gap-2" role="list" aria-label={direction === "income" ? "Rentrées par famille" : "Sorties par famille"}>
    {families.map((family, index) => {
      const Icon = FAMILY_ICONS[family.id];
      const amount = family[direction];
      const height = fmt.dummy ? 45 + index * 10 : amount / max * 110;
      const label = direction === "income" ? family.source : family.name;
      return <div key={family.id} role="listitem" aria-label={`${label} : ${fmt.euro(amount)}`} className="min-w-0 flex-1 text-center">
        <div className="flex h-36 flex-col items-center justify-end gap-1.5 border-b border-ink-100 pb-1.5 dark:border-white/10">
          <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-ink-600 dark:text-white/70">{fmt.euro(amount)}</span>
          <span className="w-full max-w-10 rounded-t-full bg-gradient-to-t from-emerald-500/35 to-emerald-300/80 shadow-[inset_1px_0_0_rgba(255,255,255,0.15)] transition-[height] duration-300" style={{ height: `${height}px`, minHeight: fmt.dummy || amount ? 3 : 0, backgroundImage: `linear-gradient(to top, ${COLORS[index]}35, ${COLORS[index]}cc)` }} />
        </div>
        <span className="mx-auto mt-2 flex h-8 w-8 items-center justify-center rounded-full border border-ink-200/60 bg-ink-50 shadow-sm dark:border-white/10 dark:bg-white/5" style={{color: COLORS[index]}}><Icon size={16} strokeWidth={1.7} aria-hidden="true" /></span>
        <span className="mt-1.5 block text-[10px] leading-tight text-ink-500 dark:text-white/55">{label}</span>
      </div>;
    })}
  </div>;
}

function PiloteSourceDetail({ title, rows, income = false }: { title: string; rows: {parent: string; name: string; amount: number}[]; income?: boolean }) {
  const fmt = useDashboardDisplayFormat();
  const parents = [...new Set(rows.map(row => row.parent))];
  return <div className="min-w-0"><h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-white/65">{title}</h5>
    {parents.length ? <div className="space-y-1.5">{parents.map(parent => <div key={parent}><p className="mb-0.5 text-[10px] font-medium text-ink-500 dark:text-white/60">{parent}</p><ul className="divide-y divide-ink-100 dark:divide-white/[.06]">{rows.filter(row => row.parent === parent).map(row => <li key={row.name} className="flex items-baseline justify-between gap-3 py-1 text-xs"><span className="min-w-0 leading-snug text-ink-800 dark:text-white/95">{row.name}</span><span className={`shrink-0 font-semibold tabular-nums ${income ? "text-emerald-600 dark:text-emerald-300" : "text-ink-900 dark:text-white"}`}>{fmt.euro(row.amount)}</span></li>)}</ul></div>)}</div> : <p className="text-xs text-ink-500 dark:text-white/65">Aucun mouvement sur cette période.</p>}
  </div>;
}

function PiloteCompensationRows({ families, month, sourceMonths }: { families: PiloteCompensation[]; month: PiloteMonth; sourceMonths: PiloteMonth[] }) {
  const fmt = useDashboardDisplayFormat();
  return <section aria-label="Compensation par famille" className="min-w-0 rounded-3xl border border-ink-200/70 bg-white px-4 py-3 shadow-card dark:border-white/[0.06] dark:bg-white/[0.04] dark:shadow-none">
    <div className="flex items-center gap-3"><div><h3 className="font-display text-sm font-semibold tracking-tight text-ink-900 dark:text-white">Compensation par famille</h3></div></div>
    <div className="mt-3 grid grid-cols-3 gap-2 border-b border-ink-200 pb-2 text-[11px] font-medium text-ink-600 dark:border-white/20 dark:text-white/80"><span>Payé</span><span>Compensé</span><span>Reste à couvrir</span></div>
    <div className="divide-y divide-ink-200 dark:divide-white/20">
      {families.map(family => {
        const expenseRows = month.categories.flatMap(parent => parent.children.filter(sub => piloteCompensationFamily(parent.name, sub.name, false) === family.id).map(sub => ({ parent: parent.name, ...sub })));
        const incomeMonths = month.month.length === 4 ? sourceMonths.filter(row => row.month.startsWith(`${month.month}-`)) : [month];
        const rawIncomeRows = incomeMonths.flatMap(period => period.incomeCategories.flatMap(parent => parent.children.filter(sub => piloteIncomeFamily(period.month, parent.name, sub.name, sub.income) === family.id).map(sub => ({ period: period.month, parent: parent.name, ...sub }))));
        const incomeRows = [...rawIncomeRows.reduce((groups, row) => {
          const key = JSON.stringify([row.parent, row.name]);
          const previous = groups.get(key);
          groups.set(key, {parent: row.parent, name: row.name, income: (Math.round((previous?.income ?? 0) * 100) + Math.round(row.income * 100)) / 100});
          return groups;
        }, new Map<string, {parent: string; name: string; income: number}>()).values()];
        const remaining = Math.max(0, -family.balance);
        const surplus = Math.max(0, family.balance);
        const coverage = fmt.dummy ? 60 : family.expenses ? family.covered / family.expenses * 100 : 0;
        return <details key={family.id} className="group py-2">
          <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold text-ink-900 dark:text-white">{family.name}</h4><p className="mt-0.5 text-[11px] leading-relaxed text-ink-600 group-open:hidden dark:text-white/80">{family.source}</p></div><ChevronRight size={16} className="text-ink-400 transition group-open:rotate-90" /></div>
            <div className="mt-2 grid grid-cols-3 gap-2"><div><p className="font-display text-base font-semibold tabular-nums tracking-tight text-ink-900 dark:text-white">{fmt.euro(family.expenses)}</p></div><div><p className="font-display text-base font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-300">{fmt.euro(family.covered)}</p></div><div><p className={`font-display text-base font-semibold tabular-nums tracking-tight ${remaining ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-200"}`}>{fmt.euro(remaining)}</p></div></div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-300/20"><div className="h-full rounded-full bg-emerald-400" style={{width: `${coverage}%`}} /></div>
            {surplus > 0 ? <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-200">Excédent : {fmt.euro(surplus)}</p> : null}
          </summary>
          <div className="mt-2 grid gap-2 border-t border-ink-200 pt-2 pb-0.5 dark:border-white/15 sm:grid-cols-2">
            <PiloteSourceDetail title="Dépenses" rows={expenseRows.map(row => ({parent: row.parent, name: row.name, amount: row.expenses}))} />
            <PiloteSourceDetail title="Rentrées" income rows={incomeRows.map(row => ({parent: row.parent, name: row.name, amount: row.income}))} />
          </div>
        </details>;
      })}
    </div>
    <p className="mt-1 border-t border-ink-200 pt-2 text-[10px] leading-relaxed text-ink-500 dark:border-white/20 dark:text-white/70">Catégories Bankin d’origine · chaque montant compté une fois · excédents conservés par famille.</p>
  </section>;
}

export function PiloteSection({ demoMode, onImported }: { demoMode: boolean; onImported: () => Promise<boolean> }) {
  const fmt = useDashboardDisplayFormat();
  const money = fmt.euro;
  const { searchParams } = useDashboardSection();
  const [snapshot, setSnapshot] = useState<BankinPiloteSnapshot | null>(null);
  const [loading, setLoading] = useState(!demoMode);
  const [loadError, setLoadError] = useState("");
  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/dashboard/pilote", { cache: "no-store" });
    if (!response.ok) throw new Error("Le bilan Bankin est indisponible. Réessayez après l’import.");
    const body = await response.json(); setSnapshot(body.snapshot ?? null); setLoadError("");
  }, []);
  useEffect(() => {
    let alive = true;
    if (!demoMode) {
      setLoading(true);
      void loadSnapshot().catch(error => { if (alive) setLoadError(error.message); }).finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [demoMode, loadSnapshot]);
  const months = demoMode ? [] : snapshot?.months ?? [];
  const [selected, setSelected] = useState("");
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");
  const selectedMonth = months.find(m => m.month === selected) ?? months.at(-1);
  const selectedYear = selectedMonth?.month.slice(0, 4) ?? "";
  const isAnnual = periodMode === "year";
  const current = isAnnual ? buildPiloteYear(months, selectedYear) : selectedMonth;
  const monthIndex = months.findIndex(m => m.month === selectedMonth?.month);
  const [connection, setConnection] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const oauthResult = searchParams.get("gmail_connect");
  useEffect(() => {
    if (oauthResult === "ok") setStatus("Gmail connecté. Cliquez sur Importer pour récupérer le dernier export Bankin.");
    if (oauthResult === "error") setStatus("Connexion Gmail interrompue ou refusée. Réessayez ou importez un fichier Excel.");
  }, [oauthResult]);
  useEffect(() => {
    let alive = true;
    if (!demoMode) void getGmailConnectionStatus().then(value => { if (alive) setConnection(value); }).catch(() => { if (alive) setStatus("Statut Gmail indisponible. Réessayez ou importez un fichier."); });
    return () => { alive = false; };
  }, [demoMode]);
  const refresh = async () => {
    await loadSnapshot();
    if (!await onImported()) toast.warning("Import enregistré. Actualisez la page pour charger toutes les opérations.");
  };
  const importFromGmail = async () => {
    if (busy || demoMode) return;
    setBusy(true); setStatus("");
    try {
      const fresh = await getGmailConnectionStatus(); setConnection(fresh);
      if (!fresh.configured) throw new Error("Gmail n’est pas configuré. Utilisez l’import Excel ci-dessous.");
      if (!fresh.connected) {
        const consent = await getGmailConnectUrl("pilote");
        window.location.assign(consent.url); return;
      }
      const response = await fetch("/api/gmail/bankin", { method: "POST", credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json(); throw new Error(body.error || "Import impossible.");
      }
      const blob = await response.blob();
      const filename = response.headers.get("X-Bankin-Filename") ?? "bankin.xlsx";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const count = Number(response.headers.get("X-Import-Inserted") ?? 0);
      const merged = Number(response.headers.get("X-Import-Merged") ?? 0);
      const already = response.headers.get("X-Import-Already") === "true";
      const message = already ? "Export déjà intégré : fichier téléchargé, aucun doublon ajouté." : `Export téléchargé et intégré : ${count} opération(s) ajoutée(s), ${merged} rapprochée(s).`;
      setStatus(message); toast.success(message); await refresh();
    } catch (error) { const message = error instanceof Error ? error.message : "Import impossible."; setStatus(message); toast.error(message); }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    setBusy(true); setStatus("");
    try {
      const form = new FormData(); form.set("file", file);
      const result = await importBankinPersonalXlsx(form);
      setStatus(`Fichier intégré : ${result.inserted.length} opération(s) ajoutée(s).`); toast.success("Export Bankin intégré."); await refresh();
    } catch (error) { const message = error instanceof Error ? error.message : "Import impossible."; setStatus(message); toast.error(message); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const compensations = current ? buildPiloteCompensations(current, months) : [];
  const years = [...new Set(months.map(m => m.month.slice(0, 4)))].reverse();
  const chartMonths = isAnnual ? months.filter(m => m.month.startsWith(`${selectedYear}-`)) : months.slice(-12);
  const chartMax = Math.max(1, ...chartMonths.flatMap(m => [m.expenses, m.income]));
  const total = current?.expenses ?? 0;
  const gradient = current && total ? current.categories.slice(0, 5).concat(current.categories.length > 5 ? [{ name: "Autres", expenses: current.categories.slice(5).reduce((sum, c) => sum + c.expenses, 0), income: 0, count: 0, children: [] }] : []).map((c, index, list) => {
    const start = list.slice(0, index).reduce((sum, c) => sum + c.expenses, 0) / total * 100;
    return `${COLORS[index]} ${start}% ${start + c.expenses / total * 100}%`;
  }).join(",") : "#1e3d3a 0% 100%";

  return <section className="space-y-6 pb-8" aria-label="Pilote financier">
    <div className="rounded-2xl border border-emerald-200/20 bg-[#082d2a] px-4 py-3 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div><h2 className="text-base font-semibold tracking-tight">Pilote</h2><p className="text-[11px] text-white/50">Votre bilan Bankin, mois par mois</p></div></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => void importFromGmail()} disabled={busy || demoMode} aria-label={connection?.connected ? "Importer le dernier export Gmail" : "Connecter Gmail et importer"} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-[#082d2a] transition hover:bg-emerald-200 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}{busy ? "Import…" : connection?.connected ? "Importer Gmail" : "Connecter Gmail"}</button><button type="button" disabled={busy || demoMode} onClick={() => fileInput.current?.click()} aria-label="Importer un fichier Bankin" title="Importer un fichier Bankin" className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs text-emerald-200 hover:bg-white/5 disabled:opacity-50"><Upload size={15} /> Excel</button><input ref={fileInput} type="file" accept=".xls,.xlsx" className="sr-only" aria-label="Fichier Excel Bankin" disabled={busy || demoMode} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></div>
      </div>
      {status ? <p role="status" className="mt-2 border-t border-white/10 pt-2 text-xs text-emerald-100">{status}</p> : null}
      {demoMode ? <p className="mt-2 text-xs text-amber-200">Import désactivé en mode démo.</p> : null}
    </div>
    {fmt.dummy ? <p className="text-xs text-amber-600 dark:text-amber-200">Affichage masqué : les montants et les pourcentages affichés sont fictifs.</p> : null}
    {loadError ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Les données peuvent être incomplètes : {loadError}</p> : null}
    <div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold text-ink-900 dark:text-white">{isAnnual ? "Le bilan de l’année" : "Le bilan du mois"}</h3><p className="mt-0.5 text-[11px] text-ink-500 dark:text-white/50">Catégories Bankin d’origine</p></div></div>
      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex rounded-full bg-ink-100/70 p-0.5 dark:bg-white/[0.06]" role="group" aria-label="Période de Pilote">{([{value: "month", label: "Mois"}, {value: "year", label: "Année entière"}] as const).map(mode => <button key={mode.value} type="button" aria-pressed={periodMode === mode.value} onClick={() => setPeriodMode(mode.value)} className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition ${periodMode === mode.value ? "bg-white text-ink-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-ink-500 dark:text-white/55"}`}>{mode.label}</button>)}</div>
        {isAnnual ? <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="Année analysée">{years.map(year => <button type="button" key={year} aria-pressed={year === selectedYear} onClick={() => setSelected(months.filter(m => m.month.startsWith(`${year}-`)).at(-1)!.month)} className={`min-h-11 rounded-full border px-3 text-xs font-medium tabular-nums ${year === selectedYear ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "border-ink-200/60 text-ink-500 dark:border-white/10 dark:text-white/55"}`}>{year}</button>)}</div> : <div className="flex items-center gap-1"><button type="button" aria-label="Mois précédent" disabled={monthIndex <= 0} onClick={() => setSelected(months[monthIndex - 1].month)} className="grid h-11 w-11 place-items-center rounded-full text-ink-400 hover:bg-ink-100/80 disabled:opacity-25 dark:text-white/45 dark:hover:bg-white/[0.06]"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-medium capitalize text-ink-700 dark:text-white/75">{selectedMonth ? monthName(selectedMonth.month) : "Aucune donnée"}</span><button type="button" aria-label="Mois suivant" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => setSelected(months[monthIndex + 1].month)} className="grid h-11 w-11 place-items-center rounded-full text-ink-400 hover:bg-ink-100/80 disabled:opacity-25 dark:text-white/45 dark:hover:bg-white/[0.06]"><ChevronRight className="h-4 w-4" /></button></div>}
        {isAnnual ? <p className="text-[10px] text-ink-500 dark:text-white/45">Totaux {selectedYear} · mois présents dans l’export Bankin</p> : null}
      </div>
      {snapshot && !demoMode ? <details className="text-[11px] text-ink-500 dark:text-white/45"><summary className="cursor-pointer">Source Bankin · {snapshot.excludedInternal} virements internes exclus · {snapshot.excludedHidden} masquées exclues</summary><p className="mt-1 break-all">{snapshot.sourceFilename} · {snapshot.sourceRows} lignes source{snapshot.shiftedRentCount !== undefined ? ` · ${snapshot.shiftedRentCount} loyers rattachés au mois suivant` : ""}</p></details> : null}
    </div>
    {loading ? <p role="status" className="text-sm text-ink-500 dark:text-white/60">Chargement du bilan Bankin…</p> : null}
    {!current && !loading ? <div className="rounded-3xl border border-dashed border-emerald-400/40 p-12 text-center"><Navigation className="mx-auto mb-4 text-emerald-500" size={36} /><h3 className="font-semibold text-ink-900 dark:text-white">Votre premier bilan commence ici</h3><p className="mx-auto mt-2 max-w-md text-sm text-ink-500 dark:text-white/60">Importez un export Bankin pour afficher son bilan exact. Les transactions générales de l’application ne sont pas utilisées.</p><a className="mt-4 inline-block text-sm text-emerald-600 underline dark:text-emerald-300" href="https://support.bankin.com/hc/fr/articles/360007523551-Exporter-votre-historique-bancaire" target="_blank" rel="noopener noreferrer">Comment demander un export Bankin</a></div> : current ? <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{[{ label: "Rentrées", value: current.income, color: "text-emerald-500", tint: "bg-emerald-500/10 ring-emerald-400/20", note: isAnnual ? "Revenus Bankin de l’année" : "Revenus Bankin du mois" }, { label: "Sorties", value: current.expenses, color: "text-amber-500", tint: "bg-amber-500/10 ring-amber-400/20", note: `${fmt.int(current.categories.reduce((sum, c) => sum + c.count, 0))} dépenses ${isAnnual ? "de l’année" : "du mois"}` }, { label: "Solde des flux", value: current.balance, color: current.balance >= 0 ? "text-emerald-500" : "text-rose-400", tint: "bg-cyan-500/10 ring-cyan-400/20", note: "Rentrées − sorties" }].map((kpi, index) => <div key={kpi.label} className={`${dashboardInsightCard} relative overflow-hidden ${index === 2 ? "md:col-span-2" : ""}`}><div className="flex items-center gap-2.5"><span className="text-xs font-medium text-ink-500 dark:text-white/60">{kpi.label}</span></div><p className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${kpi.color}`}>{money(kpi.value)}</p>{index === 2 ? <p className="mt-1 text-[11px] text-ink-400 dark:text-white/40">{kpi.note}</p> : null}{index < 2 ? <PiloteFamilyBars families={compensations} direction={index === 0 ? "income" : "expenses"} /> : null}</div>)}</div>
      <PiloteCompensationRows families={compensations} month={current} sourceMonths={months} />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><div className="min-w-0 rounded-3xl border border-ink-200/70 bg-white p-6 dark:border-white/10 dark:bg-white/[.035]"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold text-ink-900 dark:text-white">Rentrées vs sorties</h3><p className="flex gap-4 text-xs text-ink-500 dark:text-white/60"><span>🟢 Rentrées</span><span>🟡 Sorties</span></p></div><p className="mt-2 text-xs text-ink-400 dark:text-white/40">{isAnnual ? "Mois de l’année sélectionnée · cliquez pour explorer" : "12 derniers mois disponibles · cliquez pour explorer"}</p><div className="mt-6 overflow-x-auto pb-2"><div className="flex h-48 min-w-[360px] items-end gap-2" role="group" aria-label="Comparaison mensuelle des flux">{chartMonths.map(m => <button key={m.month} type="button" onClick={() => { setSelected(m.month); setPeriodMode("month"); }} aria-pressed={m.month === current.month} aria-label={`${monthName(m.month)} : rentrées ${money(m.income)}, sorties ${money(m.expenses)}`} className={`flex h-full min-w-6 flex-1 flex-col justify-end rounded-lg px-1 pt-3 transition ${m.month === current.month ? "bg-emerald-500/10 ring-1 ring-emerald-400/30" : "hover:bg-ink-50 dark:hover:bg-white/5"}`}><div className="flex h-36 items-end justify-center gap-1.5"><span className="w-3 rounded-t-md bg-emerald-400 sm:w-4" style={{ height: `${m.income / chartMax * 100}%`, minHeight: m.income ? 3 : 0 }} /><span className="w-3 rounded-t-md bg-amber-300 sm:w-4" style={{ height: `${m.expenses / chartMax * 100}%`, minHeight: m.expenses ? 3 : 0 }} /></div><span className="mt-3 truncate text-[10px] text-ink-500 dark:text-white/60">{monthName(m.month, true)}</span><span className="text-[9px] text-ink-400 dark:text-white/35">{m.month.slice(0, 4)}</span></button>)}</div></div></div>
        <div className="rounded-3xl border border-ink-200/70 bg-white p-6 dark:border-white/10 dark:bg-white/[.035]"><h3 className="font-semibold text-ink-900 dark:text-white">Ce que vos rentrées couvrent</h3><div className="mt-6 flex items-center gap-6"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`Répartition des sorties : ${current.categories.map(c => `${c.name} ${money(c.expenses)}`).join(", ")}`}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white dark:bg-[#10322f]"><strong className="text-xl text-ink-900 dark:text-white">{current.expenses ? `${fmt.dummy ? "••" : Math.round(current.income / current.expenses * 100)} %` : "—"}</strong><span className="mt-1 text-[10px] text-ink-500 dark:text-white/50">couverture</span></div></div><div><p className={`text-lg font-semibold ${current.balance >= 0 ? "text-emerald-500" : "text-rose-400"}`}>{current.balance >= 0 ? "Solde positif" : "Solde négatif"}</p><p className="mt-2 text-xs leading-relaxed text-ink-500 dark:text-white/60">{current.expenses ? `${money(current.income)} de rentrées face à ${money(current.expenses)} de sorties.` : "Aucune sortie enregistrée sur cette période."}</p></div></div><p className="mt-5 text-xs leading-relaxed text-ink-400 dark:text-white/40">Couverture globale de la période. Le détail des compensations selon vos règles figure par famille ci-dessus. Virements internes et transactions masquées exclus.</p></div></div>
      <div id="pilote-categories" className="grid scroll-mt-6 gap-5 lg:grid-cols-[1.5fr_1fr]"><div className="rounded-3xl border border-ink-200/70 bg-white p-6 dark:border-white/10 dark:bg-white/[.035]"><h3 className="font-semibold text-ink-900 dark:text-white">Où part votre argent ?</h3><p className="mt-1 text-xs text-ink-500 dark:text-white/50">Ouvrez une catégorie pour voir ses sous-catégories.</p><div className="mt-5 space-y-2">{current.categories.map((category, index) => <details key={category.name} className="group rounded-2xl border border-ink-100 dark:border-white/[.07]"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-900 dark:text-white">{category.name}</p><p className="mt-1 text-[10px] text-ink-400 dark:text-white/45">{[...new Set(category.children.map(sub => compensations.find(f => f.id === piloteCompensationFamily(category.name, sub.name, false))!.source))].join(" · ")}</p><div className="mt-2 h-1 rounded-full bg-ink-100 dark:bg-white/5"><div className="h-1 rounded-full" style={{ width: `${category.expenses / current.expenses * 100}%`, backgroundColor: COLORS[index % COLORS.length] }} /></div></div><div className="text-right"><p className="text-sm font-semibold tabular-nums text-ink-900 dark:text-white">{money(category.expenses)}</p><p className="text-[10px] text-ink-400 dark:text-white/40">{fmt.percent0to100(category.expenses / current.expenses * 100)} %</p></div><ChevronRight size={14} className="text-ink-400 transition group-open:rotate-90" /></summary><div className="space-y-3 border-t border-ink-100 px-5 py-4 dark:border-white/5">{category.children.map(sub => <div key={sub.name} className="flex justify-between gap-3 text-xs text-ink-500 dark:text-white/60"><span>{sub.name}<span className="ml-2 text-ink-400 dark:text-white/35">· {fmt.int(sub.count)} op.</span></span><span className="shrink-0 font-medium tabular-nums">{money(sub.expenses)}</span></div>)}</div></details>)}{!current.categories.length ? <p className="text-sm text-ink-500 dark:text-white/60">Aucune sortie ce mois.</p> : null}</div></div>
      <div className="space-y-5"><div className="rounded-3xl border border-ink-200/70 bg-white p-6 dark:border-white/10 dark:bg-white/[.035]"><h3 className="font-semibold text-ink-900 dark:text-white">Les rentrées qui compensent</h3><div className="mt-4 space-y-3">{current.incomeCategories.map(category => <details key={category.name} className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm"><span className="text-ink-600 dark:text-white/70">{category.name}</span><span className="font-semibold tabular-nums text-emerald-500">+ {money(category.income)}</span></summary><div className="mt-2 space-y-2 pl-3">{category.children.map(sub => <p key={sub.name} className="flex justify-between gap-2 text-xs text-ink-400 dark:text-white/45"><span>{sub.name}</span><span>{money(sub.income)}</span></p>)}</div></details>)}{!current.incomeCategories.length ? <p className="text-sm text-ink-500 dark:text-white/60">Aucune rentrée enregistrée.</p> : null}</div></div></div></div>
      <p className="text-xs leading-relaxed text-ink-400 dark:text-white/40">Calculs sur le dernier export Bankin importé. Les loyers reçus pendant les 7 derniers jours du mois sont rattachés au mois suivant ; leur date bancaire reste inchangée. Catégories inchangées. Compensation budgétaire selon vos règles explicites, sans rapprochement de transactions. Virements internes et transactions masquées exclus selon les catégories ou les indicateurs présents dans le fichier. La colonne « Pointée » ne signifie pas « masquée ».</p>
    </> : null}
  </section>;
}
