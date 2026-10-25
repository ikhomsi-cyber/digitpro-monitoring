"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Loader2, Mail, Navigation, Upload, ChevronRight, ChevronLeft } from "lucide-react";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import { gmailOAuthErrorMessage } from "@/lib/gmail/oauth-errors";
import { GmailAccountPicker } from "./GmailAccountPicker";
import type { GmailAccount } from "@/lib/gmail/accounts";
import { PilotePocketSummary } from "./PilotePocketSummary";
import { PiloteDailyChart } from "./PiloteDailyChart";
import type { PiloteDaily } from "@/lib/bankin/pilote-daily";
import dynamic from "next/dynamic";
import type { PiloteDashboardData } from "@/lib/bankin/pilote-loader";
const PiloteTravelMap = dynamic(() => import("./PiloteTravelMap").then(module => module.PiloteTravelMap), { ssr: false });
function DeferredPiloteTravel({months,period}:{months:PiloteMonth[];period:string}) {
  const target=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{if(!target.current)return;if(!window.IntersectionObserver){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"200px"});observer.observe(target.current);return()=>observer.disconnect();},[]);
  return <div ref={target} className="min-h-64">{visible?<PiloteTravelMap months={months} period={period}/>:<div className="rounded-3xl border border-ink-200/50 p-6 dark:border-white/10"><p className="text-sm font-medium text-ink-600 dark:text-white/60">Vos voyages</p></div>}</div>;
}
import { toast } from "sonner";
import { addPiloteMoroccoRent, piloteSnapshotMonths, filterPiloteIncome, filterPiloteExpenses, type PiloteExpenseView, piloteIncomeFamily, buildPiloteYear, buildPiloteCompensations, piloteCompensationFamily, type PiloteMonth, type PiloteCompensation, type BankinPiloteSnapshot } from "@/lib/pilote";
import { getGmailConnectionStatus, getGmailConnectUrl, type GmailConnectionStatus } from "@/app/dashboard/gmail-actions";
import { importBankinPersonalXlsx } from "@/app/dashboard/actions";
import { useDashboardSection } from "./DashboardSectionContext";
import { useDashboardDisplayFormat } from "./DashboardDisplayFormatContext";

const monthName = (month: string, short = false) => new Intl.DateTimeFormat("fr-FR", { month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const FAMILY_PICTOS = { rent: "🏠", transport: "🚗", ndf: "🧾", food: "🍽️", other: "💳" };
const COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185", "#60a5fa"];

function PiloteFamilyBars({ families, direction }: { families: PiloteCompensation[]; direction: "income" | "expenses" }) {
  const fmt = useDashboardDisplayFormat();
  const max = Math.max(1, ...families.map(family => family[direction]));
  return <div className="mt-5 grid grid-cols-5 gap-2 sm:gap-4" role="list" aria-label={direction === "income" ? "Rentrées par famille" : "Sorties par famille"}>
    {families.map((family, index) => {
      const amount = family[direction];
      const height = fmt.dummy ? 50 + index * 12 : amount / max * 128;
      const label = direction === "income" ? family.source : family.name;
      return <div key={family.id} role="listitem" aria-label={`${label} : ${fmt.euro(amount)}`} className="group min-w-0 text-center">
        <div className="flex h-40 flex-col items-center justify-end gap-2 border-b border-ink-200/50 pb-2 dark:border-white/15">
          <span className="whitespace-nowrap text-[11px] font-semibold tabular-nums tracking-tight text-ink-700 dark:text-white/90">{fmt.euro(amount)}</span>
          <span className="relative w-full max-w-5 sm:max-w-6 overflow-hidden rounded-t-full border-x border-t border-white/15 shadow-[inset_1px_0_0_rgba(255,255,255,0.16)] transition-[height] duration-300 motion-reduce:transition-none" style={{height: `${height}px`, minHeight: fmt.dummy || amount ? 3 : 0, backgroundImage: `linear-gradient(180deg, ${COLORS[index]}d9 0%, ${COLORS[index]}85 55%, ${COLORS[index]}18 100%)`}}><span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-br from-white/15 to-transparent" /></span>
        </div>
        <span aria-hidden="true" className="mx-auto mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-200/45 bg-ink-50/80 text-lg dark:border-white/[0.1] dark:bg-white/[0.06]">{FAMILY_PICTOS[family.id]}</span>
        <span className="mx-auto mt-2 block max-w-24 text-[10px] font-medium leading-snug text-ink-600 dark:text-white/70">{label}</span>
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
    <div className="mt-1 divide-y divide-ink-200/70 dark:divide-white/10">
      {families.map((family, index) => {
        const expenseRows = month.categories.flatMap(parent => parent.children.filter(sub => piloteCompensationFamily(parent.name, sub.name, false) === family.id).map(sub => ({ parent: parent.name, ...sub })));
        const incomeMonths = month.month.length === 4 ? sourceMonths.filter(row => row.month.startsWith(`${month.month}-`)) : [month];
        const rawIncomeRows = incomeMonths.flatMap(period => period.incomeCategories.flatMap(parent => parent.children.filter(sub => piloteIncomeFamily(period.month, parent.name, sub.name, sub.income) === family.id).map(sub => ({ period: period.month, parent: parent.name, ...sub }))));
        const incomeRows = [...rawIncomeRows.reduce((groups, row) => {
          const key = JSON.stringify([row.parent, row.name]);
          const previous = groups.get(key);
          groups.set(key, {parent: row.parent, name: row.name, income: (Math.round((previous?.income ?? 0) * 100) + Math.round(row.income * 100)) / 100});
          return groups;
        }, new Map<string, {parent: string; name: string; income: number}>()).values()];
        const moroccoIncome=family.id === "rent" ? incomeRows.filter(row=>row.parent === "Loyer Maroc ajouté").reduce((sum,row)=>sum+row.income,0) : 0;
        const withoutMoroccoIncome=family.income-moroccoIncome;
        const withoutMoroccoBalance=withoutMoroccoIncome-family.expenses;
        const remaining = Math.max(0, -family.balance);
        const surplus = Math.max(0, family.balance);
        const gaugeIncome = fmt.dummy ? 100 : family.income;
        const gaugeExpenses = fmt.dummy ? 60 : family.expenses;
        const gaugeMax = Math.max(gaugeIncome, gaugeExpenses, 1);
        const consumedWidth = Math.min(gaugeIncome, gaugeExpenses) / gaugeMax * 100;
        const overflowWidth = Math.max(0, gaugeExpenses - gaugeIncome) / gaugeMax * 100;
        const incomeMarker = gaugeIncome / gaugeMax * 100;
        const consumptionPercent = family.income > 0 ? Math.round(family.expenses / family.income * 100) : null;
        return <details key={family.id} className="group py-3">
          <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <div className="flex items-center gap-3"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:COLORS[index]}}/><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-white">{family.name}</h4><p className="mt-0.5 text-[10px] text-ink-500 dark:text-white/55">{family.source}</p></div><ChevronRight size={14} className="shrink-0 text-ink-400 transition group-open:rotate-90" /></div>
            <div className="mt-3 grid grid-cols-3 gap-3"><div><p className="text-[10px] text-ink-500 dark:text-white/55">Dépensé</p><p className="mt-1 text-base font-semibold tabular-nums tracking-tight text-ink-900 dark:text-white">{fmt.euro(family.expenses)}</p></div><div><p className="text-[10px] text-ink-500 dark:text-white/55">Reçu</p><p className="mt-1 text-base font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-300">{fmt.euro(family.income)}</p></div><div className="text-right"><p className="text-[10px] text-ink-500 dark:text-white/55">{remaining ? "À couvrir" : "Disponible"}</p><p className={`mt-1 text-base font-semibold tabular-nums tracking-tight ${remaining ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-200"}`}>{fmt.euro(remaining || surplus)}</p></div></div>
            {moroccoIncome>0?<p className="mt-2 text-[10px] text-ink-500 dark:text-white/65">{fmt.euro(withoutMoroccoIncome)} de loyers Bankin + <span className="font-medium text-emerald-600 dark:text-emerald-300">{fmt.euro(moroccoIncome)} de loyer Maroc</span></p>:null}
            <div className="relative mt-3" role="img" aria-label={fmt.dummy ? "Jauge masquée" : `${family.source} : ${fmt.euro(family.income)} reçus, ${fmt.euro(family.expenses)} dépensés${remaining ? `, dépassement de ${fmt.euro(remaining)}` : `, ${fmt.euro(surplus)} disponibles`}` }>
              <div className="flex h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/15"><div className="h-full bg-emerald-400" style={{width: `${consumedWidth}%`}} /><div className="h-full bg-rose-400" style={{width: `${overflowWidth}%`}} /></div>
              {gaugeIncome > 0 && gaugeExpenses > gaugeIncome ? <span className="absolute -top-0.5 h-2 w-px bg-ink-900 dark:bg-white" style={{left: `${incomeMarker}%`}} /> : null}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-ink-500 dark:text-white/55"><span>{fmt.dummy ? "Consommation masquée" : consumptionPercent === null ? "Aucune rentrée" : `${consumptionPercent} % des rentrées consommés`}</span>{!fmt.dummy && remaining > 0 && family.income > 0?<span>Repère à 100 %</span>:null}</div>
            {moroccoIncome>0?<div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-200/60 pt-2 dark:border-white/10"><div><p className="text-[10px] text-ink-500 dark:text-white/55">Sans loyer Maroc</p><p className={`mt-0.5 text-xs font-semibold tabular-nums ${withoutMoroccoBalance<0?"text-rose-600 dark:text-rose-300":"text-emerald-600 dark:text-emerald-300"}`}>{fmt.euro(Math.abs(withoutMoroccoBalance))} {withoutMoroccoBalance<0?"à couvrir":"disponibles"}</p><p className="mt-0.5 text-[9px] text-ink-500 dark:text-white/50">{fmt.euro(family.expenses)} − {fmt.euro(withoutMoroccoIncome)}</p></div><div className="text-right"><p className="text-[10px] text-ink-500 dark:text-white/55">Avec loyer Maroc</p><p className={`mt-0.5 text-xs font-semibold tabular-nums ${remaining?"text-rose-600 dark:text-rose-300":"text-emerald-600 dark:text-emerald-300"}`}>{fmt.euro(remaining||surplus)} {remaining?"à couvrir":"disponibles"}</p><p className="mt-0.5 text-[9px] text-ink-500 dark:text-white/50">{fmt.euro(family.expenses)} − {fmt.euro(family.income)}</p></div></div>:null}
          </summary>
          <div className="mt-2 grid gap-2 border-t border-ink-200 pt-2 pb-0.5 dark:border-white/15 sm:grid-cols-2">
            <PiloteSourceDetail title="Dépenses" rows={expenseRows.map(row => ({parent: row.parent, name: row.name, amount: row.expenses}))} />
            <PiloteSourceDetail title="Rentrées" income rows={incomeRows.map(row => ({parent: row.parent, name: row.name, amount: row.income}))} />
          </div>
        </details>;
      })}
    </div>
  </section>;
}

export function PiloteSection({ demoMode, onImported, loadData }: { demoMode: boolean; onImported: () => Promise<boolean>; loadData: (refresh?:boolean) => Promise<PiloteDashboardData> }) {
  const fmt = useDashboardDisplayFormat();
  const money = fmt.euro;
  const { searchParams, piloteExpenseViews:expenseViews, setPiloteExpenseViews:setExpenseViews } = useDashboardSection();
  const [snapshot, setSnapshot] = useState<BankinPiloteSnapshot | null>(null);
  const [daily, setDaily] = useState<PiloteDaily | null>(null);
  const [loading, setLoading] = useState(!demoMode);
  const [loadError, setLoadError] = useState("");
  const loadVersion = useRef(0);
  const loadSnapshot = useCallback(async (refresh=false) => {
    const version=++loadVersion.current;
    const body=await loadData(refresh);
    if(version!==loadVersion.current)return;
    setSnapshot(body.snapshot ?? null); setDaily(body.daily ?? null); setLoadError("");
  }, [loadData]);
  useEffect(() => {
    let alive = true;
    if (!demoMode) {
      setLoading(true);
      void loadSnapshot().catch(error => { if (alive) setLoadError(error.message); }).finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [demoMode, loadSnapshot]);
  const months = useMemo(() => demoMode ? [] : (snapshot ? piloteSnapshotMonths(snapshot) : []).map(filterPiloteIncome).map(addPiloteMoroccoRent), [demoMode, snapshot]);
  const [selected, setSelected] = useState("");
  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");
  const selectedMonth = months.find(m => m.month === selected) ?? months.at(-1);
  const selectedYear = selectedMonth?.month.slice(0, 4) ?? "";
  const isAnnual = periodMode === "year";
  const period = isAnnual ? buildPiloteYear(months, selectedYear) : selectedMonth;
  const current = period ? filterPiloteExpenses(period, expenseViews) : undefined;
  const monthIndex = months.findIndex(m => m.month === selectedMonth?.month);
  const [connection, setConnection] = useState<GmailConnectionStatus | null>(null);
  const [gmailAccount, setGmailAccount] = useState<GmailAccount>(searchParams.get("gmail_account") === "secondary" ? "secondary" : "primary");
  const gmailConnected = connection?.accounts?.find(account => account.id === gmailAccount)?.connected ?? (gmailAccount === "primary" && Boolean(connection?.connected));
  const connectGmailAccount = async (account: GmailAccount) => {
    if (busy || demoMode) return;
    setBusy(true);
    try { const consent = await getGmailConnectUrl("pilote", account); window.location.assign(consent.url); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Connexion Gmail impossible."); setBusy(false); }
  };
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const oauthResult = searchParams.get("gmail_connect");
  useEffect(() => {
    if (oauthResult === "ok") setStatus("Gmail connecté. Cliquez sur Importer pour récupérer le dernier export Bankin.");
    if (oauthResult === "error") setStatus(gmailOAuthErrorMessage(searchParams.get("gmail_error")));
  }, [oauthResult, searchParams]);
  useEffect(() => {
    let alive = true;
    const updateConnection = () => { if (!demoMode) void getGmailConnectionStatus().then(value => { if (alive) setConnection(value); }).catch(() => { if (alive) setStatus("Statut Gmail indisponible. Réessayez ou importez un fichier."); }); };
    updateConnection();
    window.addEventListener("focus", updateConnection);
    return () => { alive = false; window.removeEventListener("focus", updateConnection); };
  }, [demoMode]);
  const refresh = async () => {
    await loadSnapshot(true);
    if (!await onImported()) toast.warning("Import enregistré. Actualisez la page pour charger toutes les opérations.");
  };
  const importFromGmail = async () => {
    if (busy || demoMode) return;
    setBusy(true); setStatus("Récupération et intégration de l’export en cours…");
    try {
      const fresh = await getGmailConnectionStatus(); setConnection(fresh);
      if (!fresh.configured) throw new Error("Gmail n’est pas configuré. Utilisez l’import Excel ci-dessous.");
      if (!(fresh.accounts?.find(account => account.id === gmailAccount)?.connected ?? (gmailAccount === "primary" && fresh.connected))) {
        const consent = await getGmailConnectUrl("pilote", gmailAccount);
        window.location.assign(consent.url); return;
      }
      const response = await fetch(`/api/gmail/bankin?account=${gmailAccount}`, { method: "POST", credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json(); throw new Error(body.error || "Import impossible.");
      }
      const result = await response.json();
      const message = result.warning ? `Bilan Pilote intégré. ${result.warning}` : result.alreadyImported ? "Export déjà intégré : aucun doublon ajouté." : `Export intégré : ${result.inserted} opération(s) ajoutée(s), ${result.merged} rapprochée(s). Historique Pilote conservé.`;
      setStatus(message); if (result.warning) toast.warning(message); else toast.success(message); await refresh();
    } catch (error) { const message = error instanceof Error ? error.message : "Import impossible."; setStatus(message); toast.error(message); }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    setBusy(true); setStatus("");
    try {
      const form = new FormData(); form.set("file", file);
      const result = await importBankinPersonalXlsx(form);
      setStatus(`Fichier intégré : ${result.inserted.length} opération(s) ajoutée(s). Historique Pilote conservé.`); toast.success("Export Bankin intégré."); await refresh();
    } catch (error) { const message = error instanceof Error ? error.message : "Import impossible."; setStatus(message); toast.error(message); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const compensations = current ? buildPiloteCompensations(current, months) : [];
  const years = [...new Set(months.map(m => m.month.slice(0, 4)))].reverse();

  return <section className="space-y-4 pb-28 md:pb-8" aria-label="Pilote financier">
    {current&&!loading?<PilotePocketSummary hero families={compensations} periodLabel={`${isAnnual?selectedYear:selectedMonth?monthName(selectedMonth.month):""} · ${expenseViews.map(view=>({essential:"Essentiel",secondary:"Presque essentiel",travel:"Voyages"}[view])).join(" + ")||"Aucune vue"}`}/>:null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-ink-100/70 p-0.5 dark:bg-white/[0.06]" role="group" aria-label="Période de Pilote">{([{value: "month", label: "Mois"}, {value: "year", label: "Année entière"}] as const).map(mode => <button key={mode.value} type="button" aria-pressed={periodMode === mode.value} onClick={() => setPeriodMode(mode.value)} className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition ${periodMode === mode.value ? "bg-white text-ink-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-ink-500 dark:text-white/55"}`}>{mode.label}</button>)}</div>
        {isAnnual ? <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="Année analysée">{years.map(year => <button type="button" key={year} aria-pressed={year === selectedYear} onClick={() => setSelected(months.filter(m => m.month.startsWith(`${year}-`)).at(-1)!.month)} className={`min-h-11 rounded-full border px-3 text-xs font-medium tabular-nums ${year === selectedYear ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "border-ink-200/60 text-ink-500 dark:border-white/10 dark:text-white/55"}`}>{year}</button>)}</div> : <div className="flex items-center gap-1"><button type="button" aria-label="Mois précédent" disabled={monthIndex <= 0} onClick={() => setSelected(months[monthIndex - 1].month)} className="grid h-9 w-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100/80 disabled:opacity-25 dark:text-white/45 dark:hover:bg-white/[0.06]"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-medium capitalize text-ink-700 dark:text-white/75">{selectedMonth ? monthName(selectedMonth.month) : "Aucune donnée"}</span><button type="button" aria-label="Mois suivant" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => setSelected(months[monthIndex + 1].month)} className="grid h-9 w-8 place-items-center rounded-full text-ink-400 hover:bg-ink-100/80 disabled:opacity-25 dark:text-white/45 dark:hover:bg-white/[0.06]"><ChevronRight className="h-4 w-4" /></button></div>}
        {isAnnual ? <p className="text-[10px] text-ink-500 dark:text-white/45">Totaux {selectedYear} · mois présents dans l’export Bankin</p> : null}
      </div>
    <div className="space-y-2"><div role="group" aria-label="Vue des dépenses" className="flex rounded-full bg-ink-100/70 p-1 dark:bg-white/[0.06]">{([{value: "essential", label: "Essentiel"}, {value: "secondary", label: "Presque essentiel"}, {value: "travel", label: "Voyages"}] as const).map(view => <button key={view.value} type="button" aria-pressed={expenseViews.includes(view.value)} onClick={() => setExpenseViews(selected => selected.includes(view.value) ? selected.filter(value => value !== view.value) : [...selected, view.value])} className={`min-h-10 min-w-0 flex-1 rounded-full px-2 text-xs font-semibold transition ${expenseViews.includes(view.value) ? "bg-white text-ink-900 shadow-sm dark:bg-white/15 dark:text-white" : "text-ink-500 dark:text-white/60"}`}>{view.label}</button>)}</div></div>
    {current&&!isAnnual&&selectedMonth?<PiloteDailyChart key={selectedMonth.month} days={daily?.[selectedMonth.month]} month={selectedMonth.month} views={expenseViews}/>:null}
    {fmt.dummy ? <p className="text-xs text-amber-600 dark:text-amber-200">Affichage masqué : les montants et les pourcentages affichés sont fictifs.</p> : null}
    {loadError ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Les données peuvent être incomplètes : {loadError}</p> : null}
    {loading ? <p role="status" className="text-sm text-ink-500 dark:text-white/60">Chargement du bilan Bankin…</p> : null}
    {!current && !loading ? <div className="rounded-3xl border border-dashed border-emerald-400/40 p-12 text-center"><Navigation className="mx-auto mb-4 text-emerald-500" size={36} /><h3 className="font-semibold text-ink-900 dark:text-white">Votre premier bilan commence ici</h3><p className="mx-auto mt-2 max-w-md text-sm text-ink-500 dark:text-white/60">Importez un export Bankin pour afficher son bilan exact. Les transactions générales de l’application ne sont pas utilisées.</p><a className="mt-4 inline-block text-sm text-emerald-600 underline dark:text-emerald-300" href="https://support.bankin.com/hc/fr/articles/360007523551-Exporter-votre-historique-bancaire" target="_blank" rel="noopener noreferrer">Comment demander un export Bankin</a></div> : current ? <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{[{ label: "Rentrées · toutes vues", value: current.income, color: "text-emerald-500", tint: "bg-emerald-500/10 ring-emerald-400/20", note: isAnnual ? "Revenus Bankin de l’année" : "Revenus Bankin du mois" }, { label: "Sorties", value: current.expenses, color: "text-amber-500", tint: "bg-amber-500/10 ring-amber-400/20", note: `${fmt.int(current.categories.reduce((sum, c) => sum + c.count, 0))} dépenses ${isAnnual ? "de l’année" : "du mois"}` }, { label: "Rentrées − dépenses de cette vue", value: current.balance, color: current.balance >= 0 ? "text-emerald-500" : "text-rose-400", tint: "bg-cyan-500/10 ring-cyan-400/20", note: "Les rentrées restent communes : ne pas additionner les soldes des vues." }].map((kpi, index) => <div key={kpi.label} className={`${dashboardInsightCard} relative overflow-hidden ${index === 2 ? "md:col-span-2" : ""}`}><div className="flex items-center gap-2.5"><span className="text-xs font-medium text-ink-500 dark:text-white/60">{kpi.label}</span></div><p className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${kpi.color}`}>{money(kpi.value)}</p>{index === 2 ? <p className="mt-1 text-[11px] text-ink-400 dark:text-white/40">{kpi.note}</p> : null}{index < 2 ? <PiloteFamilyBars families={compensations} direction={index === 0 ? "income" : "expenses"} /> : null}</div>)}</div>
      <PiloteCompensationRows families={compensations} month={current} sourceMonths={months} />
      <div id="pilote-categories" className="grid scroll-mt-6 gap-5 lg:grid-cols-[1.5fr_1fr]"><details className="group/category rounded-3xl border border-ink-200/70 bg-white p-6 dark:border-white/10 dark:bg-white/[.035]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><h3 className="font-semibold text-ink-900 dark:text-white">Où part votre argent ?</h3><ChevronRight size={16} className="text-ink-400 transition group-open/category:rotate-90" /></summary><p className="mt-1 text-xs text-ink-500 dark:text-white/50">Ouvrez une catégorie pour voir ses sous-catégories.</p><div className="mt-5 space-y-2">{current.categories.map((category, index) => <details key={category.name} className="group rounded-2xl border border-ink-100 dark:border-white/[.07]"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-900 dark:text-white">{category.name}</p><p className="mt-1 text-[10px] text-ink-400 dark:text-white/45">{[...new Set(category.children.map(sub => compensations.find(f => f.id === piloteCompensationFamily(category.name, sub.name, false))!.source))].join(" · ")}</p><div className="mt-2 h-1 rounded-full bg-ink-100 dark:bg-white/5"><div className="h-1 rounded-full" style={{ width: `${category.expenses / current.expenses * 100}%`, backgroundColor: COLORS[index % COLORS.length] }} /></div></div><div className="text-right"><p className="text-sm font-semibold tabular-nums text-ink-900 dark:text-white">{money(category.expenses)}</p><p className="text-[10px] text-ink-400 dark:text-white/40">{fmt.percent0to100(category.expenses / current.expenses * 100)} %</p></div><ChevronRight size={14} className="text-ink-400 transition group-open:rotate-90" /></summary><div className="space-y-3 border-t border-ink-100 px-5 py-4 dark:border-white/5">{category.children.map(sub => <div key={sub.name} className="flex justify-between gap-3 text-xs text-ink-500 dark:text-white/60"><span>{sub.name}<span className="ml-2 text-ink-400 dark:text-white/35">· {fmt.int(sub.count)} op.</span></span><span className="shrink-0 font-medium tabular-nums">{money(sub.expenses)}</span></div>)}</div></details>)}{!current.categories.length ? <p className="text-sm text-ink-500 dark:text-white/60">Aucune sortie ce mois.</p> : null}</div></details>
      <div className="space-y-5"><div className="rounded-3xl border border-ink-200/70 bg-white p-6 dark:border-white/10 dark:bg-white/[.035]"><h3 className="font-semibold text-ink-900 dark:text-white">Les rentrées qui compensent</h3><div className="mt-4 space-y-3">{current.incomeCategories.map(category => <details key={category.name} className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm"><span className="text-ink-600 dark:text-white/70">{category.name}</span><span className="font-semibold tabular-nums text-emerald-500">+ {money(category.income)}</span></summary><div className="mt-2 space-y-2 pl-3">{category.children.map(sub => <p key={sub.name} className="flex justify-between gap-2 text-xs text-ink-400 dark:text-white/45"><span>{sub.name}</span><span>{money(sub.income)}</span></p>)}</div></details>)}{!current.incomeCategories.length ? <p className="text-sm text-ink-500 dark:text-white/60">Aucune rentrée enregistrée.</p> : null}</div></div></div></div>
      <DeferredPiloteTravel months={months} period={current.month} />
    </> : null}
    <section aria-label="Sources et imports Pilote" className="space-y-3 rounded-3xl border border-ink-200/60 bg-white/40 p-4 dark:border-white/10 dark:bg-white/[.025]">
      <div><h3 className="text-sm font-semibold text-ink-900 dark:text-white">Sources et imports</h3><p className="mt-1 text-[11px] text-ink-500 dark:text-white/45">Ajoutez vos exports Bankin à votre historique.</p></div>
      <GmailAccountPicker compact status={connection} value={gmailAccount} onChange={setGmailAccount} onConnect={account => void connectGmailAccount(account)} disabled={busy || demoMode} />
      <div className="flex items-center gap-2"><button type="button" onClick={() => void importFromGmail()} disabled={busy || demoMode} aria-label={gmailConnected ? "Importer le dernier export Gmail" : "Connecter Gmail et importer"} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}{busy ? "Import…" : gmailConnected ? "Importer Gmail" : "Connecter Gmail"}</button><button type="button" disabled={busy || demoMode} onClick={() => fileInput.current?.click()} aria-label="Importer un fichier Bankin" title="Importer un fichier Bankin" className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200/70 px-3 py-2 text-xs font-medium text-ink-600 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"><Upload size={15} /> Excel</button><input ref={fileInput} type="file" accept=".xls,.xlsx" className="sr-only" aria-label="Fichier Excel Bankin" disabled={busy || demoMode} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></div>
      {status ? <p role="status" className="mt-2 border-t border-ink-200/45 pt-2 text-xs text-ink-600 dark:border-white/10 dark:text-white/70">{status}</p> : null}
      {demoMode ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">Import désactivé en mode démo.</p> : null}
    </section>
  </section>;
}
