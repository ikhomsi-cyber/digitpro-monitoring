import { ArrowUpRight, BriefcaseBusiness, ShieldCheck, ChevronDown, House } from "lucide-react";
import type { BriefActivity } from "@/lib/daily-brief-activity";
import type { BriefItem } from "@/lib/daily-financial-brief";

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const dateLabel = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(`${date}T12:00:00Z`));
const secondary = "text-xs leading-relaxed text-ink-500 dark:text-white/60";
const change = (value: number | null | undefined) => value == null ? "" : ` · ${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % vs N−1 à date comparable`;

/** Presentation only: all amounts and scenario values come from the existing brief. */
export function DailyBriefSummary({ activity, date }: { activity: BriefActivity | null | undefined; date: string }) {
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(`${date}T12:00:00Z`));
  const treasury = activity?.treasury;
  const invoice = activity?.nextInvoice;
  return <>
    <section aria-label="Activité par période" className="flex items-start gap-3 py-4">
      <BriefcaseBusiness size={17} className="mt-0.5 shrink-0 text-[var(--app-accent)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-semibold">Activité</h3>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-ink-500 dark:text-white/55">Ce mois-ci · {month}</p>
        <p className="mt-1 text-sm">{activity?.workedMonth == null ? "Jours à compléter" : `${activity.workedMonth} j réalisés · ${activity.plannedMonth ?? 0} j encore planifiés`}</p>
        <p className="mt-1 text-[11px] text-ink-500 dark:text-white/50">Arrêté au {dateLabel(date)} · le planifié reste à réaliser.</p>
        <details className="mt-3 border-t border-ink-200/40 pt-2 dark:border-white/10">
          <summary className="min-h-9 cursor-pointer py-2 text-[11px] font-medium text-ink-600 dark:text-white/70">Voir le bilan depuis janvier</summary>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-ink-500 dark:text-white/55">Depuis janvier · arrêté au {dateLabel(date)}</p>
          <AnnualActivityChart activity={activity} year={Number(date.slice(0,4))}/>

        </details>
      </div>
    </section>
    <section aria-label="Trésorerie et versement personnel" className="flex items-start gap-3 py-4">
      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-sky-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold">Trésorerie · Pro → Perso</h3><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Aujourd’hui</span></div>
        <p className={`mt-2 ${secondary}`}>Disponible théorique à verser aujourd’hui</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{treasury ? money(treasury.availableTransferNow) : "À compléter"}</p>
        <p className={`mt-2 ${secondary}`}>{treasury ? treasury.shortfall > 0 ? `${money(treasury.shortfall)} de réserve restent à sécuriser.` : "Réserve couverte aujourd’hui." : "Couverture à vérifier : données de trésorerie incomplètes."}</p>
        {invoice ? <details aria-label="Simulation après encaissement" className="group/simulation mt-4 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[.08] to-transparent p-4 dark:border-sky-300/15">
          <summary className="relative min-h-9 cursor-pointer list-none pr-6 text-xs font-medium"><ChevronDown aria-hidden="true" size={15} className="absolute right-0 top-1 text-sky-500 transition-transform group-open/simulation:rotate-180"/><span className="mb-1 block text-[9px] uppercase tracking-wider text-sky-700 dark:text-sky-300">Simulation · non disponible aujourd’hui</span>{invoice.kind === "estimate" ? "Scénario après facturation puis encaissement" : `Scénario après encaissement de la facture${invoice.reference ? ` ${invoice.reference}` : " attendue"}`}</summary>
          <p className={`mt-3 ${secondary}`}>{money(invoice.invoiceAmountHt)} HT · {money(invoice.invoiceAmountHt * 1.2)} TTC{invoice.dueDate ? ` · échéance ${dateLabel(invoice.dueDate)}` : " · échéance non renseignée"}.</p>
          <p className="mt-4 text-[10px] uppercase tracking-wider text-ink-500 dark:text-white/60">Disponible théorique après encaissement intégral</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-300">{treasury?.availableTransferAfterInvoice != null ? money(treasury.availableTransferAfterInvoice) : "À compléter"}</p>
          {treasury?.projectedShortfall != null ? <p className={`mt-1 ${secondary}`}>{treasury.projectedShortfall > 0 ? `Encore ${money(treasury.projectedShortfall)} de réserve à sécuriser.` : "La réserve serait couverte."}</p> : null}
        </details> : null}
        <details className="mt-3 text-[10px] leading-relaxed text-ink-500 dark:text-white/50"><summary className="min-h-8 cursor-pointer py-1">Comprendre le disponible</summary><p className="pt-1">Après réserve CSG 17,2 % + TVA, hors IR, autres échéances et dépenses pro à venir. À vérifier avant un virement.</p></details>
      </div>
    </section>
  </>;
}

export function dailyBriefActionLabel(item: BriefItem): string {
  if (item.id === "invoice-followup") return "Voir la facture attendue";
  if (item.id === "treasury172") return "Vérifier la réserve avant un versement";
  if (item.id === "household-cash") return "Voir les dépenses dans Pilote";
  if (item.id === "categorize") return "Classer les dépenses à vérifier";
  if (item.id === "ndf") return "Vérifier les frais et justificatifs";
  if (item.id === "prepare-invoice") return "Préparer la prochaine facture";
  if (item.id === "weekly-check") return "Vérifier le calendrier et les factures";
  if (item.id.startsWith("pro-")) return `Examiner les dépenses : ${item.id.slice(4)}`;
  if (item.id.startsWith("foyer-")) return `Examiner les dépenses : ${item.id.slice(6)}`;
  if (item.id.startsWith("compensation-")) return "Vérifier les compensations du foyer";
  return item.scope === "foyer" ? "Examiner le bilan du foyer" : "Examiner le suivi professionnel";
}

export function DailyBriefActions({ items, onNavigate }: { items: BriefItem[]; onNavigate: () => void }) {
  if (!items.length) return null;
  return <section className="mt-4 border-t border-ink-200/50 pt-4 dark:border-white/10" aria-label="Actions prioritaires">
    <h3 className="text-[10px] font-medium uppercase tracking-wider text-ink-500 dark:text-white/55">Vos prochaines actions</h3>
    <div className="mt-3 divide-y divide-ink-200/40 dark:divide-white/10">{items.map(item=><article key={item.id} className="py-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">{item.scope==='foyer'?<House size={17}/>:<ShieldCheck size={17}/>}</span><div className="min-w-0 flex-1"><p className="text-[9px] uppercase tracking-wider text-ink-500 dark:text-white/50">{item.scope==='foyer'?'Foyer':'Professionnel'} · {item.when}</p><p className="mt-1 text-sm font-semibold leading-6">{item.title}</p><a href={item.href} onClick={onNavigate} className="mt-2 inline-flex min-h-9 items-center gap-2 text-xs font-medium text-[var(--app-accent-deep)] dark:text-[var(--app-accent)]">{dailyBriefActionLabel(item)}<ArrowUpRight size={13} aria-hidden="true"/></a><details className="group/action mt-1"><summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 text-[11px] text-ink-500 dark:text-white/55">Comprendre le calcul<ChevronDown size={12} className="transition-transform group-open/action:rotate-180"/></summary><p className={`border-l-2 border-emerald-500/30 pl-3 ${secondary}`}>{item.detail}</p></details></div></div></article>)}</div>
  </section>;
}

function AnnualActivityChart({activity,year}:{activity:BriefActivity|null|undefined;year:number}){
 const history=[...(activity?.history??[])].sort((a,b)=>a.year-b.year);
 const indicators=[{label:'CA généré / facturé',key:'generatedHt' as const},{label:'CA réellement encaissé',key:'cashedHt' as const},{label:'Dépenses professionnelles',key:'expensesHt' as const}];
 return <figure className="mt-4" aria-label="Bilan annuel depuis le début à date comparable"><figcaption className="text-[10px] text-ink-500 dark:text-white/60">Toutes les années disponibles · montants HT à date comparable</figcaption><div className="mt-4 space-y-5">{indicators.map(indicator=>{const maximum=Math.max(1,...history.map(point=>point[indicator.key]??0));return <div key={indicator.key}><p className="text-xs font-medium">{indicator.label}</p><div tabIndex={0} role="region" aria-label={`${indicator.label} par année`} className="mt-3 overflow-x-auto pb-2"><div className="flex min-w-full items-end gap-3" style={{width:Math.max(280,history.length*68)}}>{history.map(point=>{const value=point[indicator.key];return <div key={point.year} className="flex min-w-14 flex-1 flex-col items-center"><span className="mb-2 text-[9px] tabular-nums">{value==null?'—':money(value)}</span><div className="flex h-24 w-full items-end justify-center border-b border-ink-200/40 dark:border-white/10"><div aria-hidden="true" className={`w-7 rounded-t-lg ${point.year===year?'bg-emerald-500':'bg-sky-400/50'}`} style={{height:value==null?'0%':`${Math.max(0,value)/maximum*100}%`}}/></div><span className="mt-2 text-[10px] text-ink-500 dark:text-white/60">{point.year}</span></div>;})}</div></div></div>;})}</div>{!history.length?<p className="mt-3 text-xs text-ink-500">Historique indisponible.</p>:null}</figure>;
}
