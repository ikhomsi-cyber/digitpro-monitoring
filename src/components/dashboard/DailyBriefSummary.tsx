import { ArrowUpRight, BriefcaseBusiness, ShieldCheck } from "lucide-react";
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
  const previous = activity?.history[1];
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
          <dl className="mt-2 space-y-2">
            <div><dt className={secondary}>CA généré / facturé{activity?.history[0]?.invoiceCount ? " · factures Gmail + calendrier" : ""}</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums">{activity?.generatedRevenueHt == null ? "À compléter" : `${money(activity.generatedRevenueHt)} HT`}<span className="font-normal text-ink-500 dark:text-white/60">{change(activity?.generatedChangePercent)}</span></dd></div>
            <div><dt className={secondary}>CA réellement encaissé</dt><dd className="mt-0.5 text-sm tabular-nums">{activity ? `${money(activity.yearRevenueHt)} HT` : "Indisponible"}<span className="text-ink-500 dark:text-white/60">{change(activity?.yearChangePercent)}</span></dd></div>
            <div><dt className={secondary}>Dépenses professionnelles</dt><dd className="mt-0.5 text-sm tabular-nums">{activity ? `${money(activity.yearExpensesHt)} HT` : "Indisponibles"}<span className="text-ink-500 dark:text-white/60">{change(activity?.expenseChangePercent)}</span></dd></div>
          </dl>
          {previous ? <details className="mt-3"><summary className="min-h-8 cursor-pointer py-1 text-[11px] text-ink-500 dark:text-white/60">Voir les montants comparés en {previous.year}</summary><p className={`mt-1 ${secondary}`}>CA généré / facturé : {previous.generatedHt == null ? "À compléter" : `${money(previous.generatedHt)} HT`}. {previous.workedDays == null ? "" : `${previous.workedDays.toLocaleString("fr-FR")} jours cumulés depuis janvier.`}</p>{activity?.previousYearExpensesHt != null ? <p className={`mt-1 ${secondary}`}>Dépenses pro : {money(activity.previousYearExpensesHt)} HT à la même date en {Number(date.slice(0, 4)) - 1}.</p> : null}</details> : null}
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
        {invoice ? <details aria-label="Simulation après encaissement" className="mt-4 rounded-xl border border-sky-500/15 bg-sky-500/[.04] p-3 dark:border-sky-300/15 dark:bg-sky-400/[.04]">
          <summary className="min-h-9 cursor-pointer text-xs font-medium"><span className="mb-1 block text-[9px] uppercase tracking-wider text-sky-700 dark:text-sky-300">Simulation · non disponible aujourd’hui</span>{invoice.kind === "estimate" ? "Scénario après facturation puis encaissement" : `Scénario après encaissement de la facture${invoice.reference ? ` ${invoice.reference}` : " attendue"}`}</summary>
          <p className={`mt-3 ${secondary}`}>{money(invoice.invoiceAmountHt)} HT · {money(invoice.invoiceAmountHt * 1.2)} TTC{invoice.dueDate ? ` · échéance ${dateLabel(invoice.dueDate)}` : " · échéance non renseignée"}.</p>
          <p className="mt-2 text-sm font-medium tabular-nums">{treasury?.availableTransferAfterInvoice != null ? `${money(treasury.availableTransferAfterInvoice)} théoriquement disponibles après encaissement intégral.` : "Disponible après encaissement à compléter."}</p>
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
  if (item.id === "household-cash") return "Examiner les dépenses et rentrées du foyer";
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
    <div className="mt-3 space-y-3">{items.map(item => <article key={item.id} className="rounded-xl border border-ink-200/50 p-3 dark:border-white/10">
      <a href={item.href} onClick={onNavigate} className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-[var(--app-accent-deep)] dark:text-[var(--app-accent)]">{dailyBriefActionLabel(item)}<ArrowUpRight size={14} aria-hidden="true" /></a>
      <p className="mt-1 text-[11px] text-ink-500 dark:text-white/60">{item.when} · {item.title}</p>
      <details className="mt-2"><summary className="cursor-pointer py-1 text-[11px] text-ink-500 dark:text-white/55">Pourquoi cette action ?</summary><p className={`mt-2 ${secondary}`}>{item.detail}</p></details>
    </article>)}</div>
  </section>;
}
