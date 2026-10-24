import { buildBriefActivity, type BriefActivity, type BriefWorkSettings } from "@/lib/daily-brief-activity";
import type { HiwayInvoice } from "@/lib/gmail/hiway-invoice-parser";
import { countsTowardDashboardExpenseTotal, expenseDashboardGroupingLabel, type DashboardTx } from "@/lib/dashboard-metrics";
import { isRevenueCategory } from "@/lib/revenue-category";
import { piloteSnapshotMonths, filterPiloteIncome, addPiloteMoroccoRent, buildPiloteCompensations, type PiloteCompensation, type BankinPiloteSnapshot } from "@/lib/pilote";
export type BriefItem = { id: string; scope: "pro" | "foyer"; priority: "attention" | "action" | "info"; title: string; detail: string; href: string; when: "Aujourd’hui" | "Cette semaine" };
export type BriefOpportunity = {id:string;title:string;detail:string;href:string};
export type DailyBrief = { activity: BriefActivity|null; summary: {activity:string;treasury:string;household:string}; compensations:PiloteCompensation[]; opportunities:BriefOpportunity[]; date: string; month: string; pro: { revenue: number; expenses: number; previousExpenses: number; latestDate: string | null } | null; household: { income: number; expenses: number; balance: number; importedAt: string } | null; items: BriefItem[]; warnings: string[] };
const euro = (n: number) => new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
const round = (n: number) => Math.round(n * 100) / 100;
export function parisDay(now = new Date()) { return new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }
export function briefPeriod(date: string) {
 const month = date.slice(0,7), day = Number(date.slice(8,10));
 const previous = new Date(`${month}-01T12:00:00Z`);previous.setUTCMonth(previous.getUTCMonth()-1);
 const previousMonth = previous.toISOString().slice(0,7);
 const lastDay = new Date(Date.UTC(previous.getUTCFullYear(),previous.getUTCMonth()+1,0)).getUTCDate();
 return {month,previousMonth,previousEnd:`${previousMonth}-${String(Math.min(day,lastDay)).padStart(2,"0")}`};
}
/** Deterministic analysis: reference comparisons, never invented budgets or spending targets. */
export function buildDailyBrief({date,transactions,snapshot,warnings=[],work=null,invoices=null,cash=null}:{date:string;transactions:DashboardTx[]|null;snapshot:BankinPiloteSnapshot|null;warnings?:string[];work?:BriefWorkSettings|null;invoices?:HiwayInvoice[]|null;cash?:number|null}):DailyBrief {
 const {month,previousMonth,previousEnd}=briefPeriod(date);
 const items:BriefItem[]=[];const notices=[...warnings];
 const proRows=transactions?.filter(t=>(t.scope??"pro")==="pro" && Number.isFinite(t.amount) && t.date<=date)??[];
 const current=proRows.filter(t=>t.date.startsWith(month));
 const previous=proRows.filter(t=>t.date.startsWith(previousMonth)&&t.date<=previousEnd);
 const spend=(rows:DashboardTx[])=>round(rows.filter(countsTowardDashboardExpenseTotal).reduce((n,t)=>n-t.amount,0));
 const pro=transactions ? {revenue:round(current.filter(t=>t.amount>0&&isRevenueCategory(t.category)).reduce((n,t)=>n+t.amount,0)),expenses:spend(current),previousExpenses:spend(previous),latestDate:proRows.map(t=>t.date).sort().at(-1)??null}:null;
 if(pro){
  if(!current.length)notices.push("Aucune opération pro importée sur le mois courant : le bilan est incomplet.");
  else if(pro.latestDate && (Date.parse(`${date}T12:00:00Z`)-Date.parse(`${pro.latestDate}T12:00:00Z`))/86400000>7)notices.push(`Dernière opération pro disponible : ${pro.latestDate}. Vérifiez la synchronisation.`);
  const groups=new Map<string,{now:number;before:number}>();
  for(const [rows,key] of [[current,"now"],[previous,"before"]] as const)for(const tx of rows.filter(countsTowardDashboardExpenseTotal)){
   const category=expenseDashboardGroupingLabel(tx,"sasu")||"À catégoriser";const totals=groups.get(category)??{now:0,before:0};totals[key]-=tx.amount;groups.set(category,totals);
  }
  const increases=[...groups].filter(([,v])=>v.before>=25&&v.now-v.before>=50&&v.now>v.before*1.2).sort((a,b)=>(b[1].now-b[1].before)-(a[1].now-a[1].before)).slice(0,3);
  for(const [category,v] of increases)items.push({id:`pro-${category}`,scope:"pro",priority:"attention",title:`${category} en hausse`,detail:`${euro(v.now)} contre ${euro(v.before)} à date comparable le mois précédent. Vérifiez les achats ponctuels et leur classement ; ce repère n’est pas un budget.`,href:"/dashboard?section=sasu&scope=pro",when:"Aujourd’hui"});
  const uncategorized=current.filter(t=>t.amount<0&&(!t.category.trim()||/^(autres?|non catégorisé|à catégoriser|uncategorized)$/i.test(t.category.trim())));
  if(uncategorized.length)items.push({id:"categorize",scope:"pro",priority:"action",title:"Compléter le classement des dépenses",detail:`${uncategorized.length} opération(s) pro à vérifier avant de finaliser le suivi du mois.`,href:"/categorisation",when:"Cette semaine"});
  const ndf=current.filter(t=>t.amount<0&&/ndf|restaurant|repas/i.test(t.category));
  if(ndf.length)items.push({id:"ndf",scope:"pro",priority:"action",title:"Faire le point sur les frais professionnels",detail:`${ndf.length} opération(s) de repas ou notes de frais repérée(s). Vérifiez les justificatifs, le motif professionnel et les remboursements déjà effectués. Aucune pièce manquante n’est présumée.`,href:"/dashboard?section=private",when:"Cette semaine"});
  if(current.length&&!increases.length)items.push({id:"pro-reference",scope:"pro",priority:"info",title:"Aucune hausse marquée détectée côté pro",detail:previous.length?"Sur les catégories comparables : seuil de repérage +20 % et +50 €. Cela ne valide ni un budget ni l’exhaustivité des imports.":"Le mois précédent manque pour établir une comparaison fiable.",href:"/dashboard?section=sasu&scope=pro",when:"Aujourd’hui"});
 }
 const householdMonths=snapshot?piloteSnapshotMonths(snapshot):[];
 const householdMonth=householdMonths.find(m=>m.month===month);
 const household=householdMonth?{income:householdMonth.income,expenses:householdMonth.expenses,balance:round(householdMonth.income-householdMonth.expenses),importedAt:snapshot!.importedAt}:null;
 if(!household)notices.push("Bilan du foyer indisponible pour le mois courant. Actualisez l’import Bankin dans Pilote.");
 else {
  if((Date.parse(`${date}T23:59:59Z`)-Date.parse(household.importedAt))/86400000>7)notices.push("L’import Bankin du foyer date de plus de 7 jours : les écarts peuvent être incomplets.");
  if(household.balance<0)items.push({id:"household-cash",scope:"foyer",priority:"attention",title:"Les sorties du foyer dépassent les rentrées importées",detail:`Écart de ${euro(-household.balance)} ce mois-ci. Vérifiez les revenus encore attendus et les dépenses prévues cette semaine. Il s’agit d’un flux net, pas du solde bancaire.`,href:"/dashboard?section=pilote",when:"Aujourd’hui"});
  const before=householdMonths.find(m=>m.month===previousMonth);
  const rises=householdMonth!.categories.flatMap(category=>{
   const baseline=before?.categories.find(c=>c.name===category.name)?.expenses??0;
   return baseline>=25&&category.expenses>baseline*1.2&&category.expenses-baseline>=50?[{category,baseline}]:[];
  }).sort((a,b)=>(b.category.expenses-b.baseline)-(a.category.expenses-a.baseline)).slice(0,3);
  for(const {category,baseline} of rises)items.push({id:`foyer-${category.name}`,scope:"foyer",priority:"attention",title:`${category.name} : un point à regarder`,detail:`Déjà ${euro(category.expenses)} ce mois-ci, contre ${euro(baseline)} sur tout le mois précédent. Vérifiez si cette hausse est ponctuelle avant d’ajuster vos dépenses.`,href:"/dashboard?section=pilote",when:"Cette semaine"});
  if(household.balance>=0&&!rises.length)items.push({id:"foyer-reference",scope:"foyer",priority:"info",title:"Les rentrées importées couvrent les sorties du foyer",detail:"Aucun déséquilibre de flux détecté sur les données de ce mois. Les prélèvements et paiements à venir ne sont pas inclus.",href:"/dashboard?section=pilote",when:"Aujourd’hui"});
 }
 if(!items.some(i=>i.when==="Cette semaine"))items.push({id:"weekly-check",scope:"pro",priority:"action",title:"Préparer le point de fin de semaine",detail:"Rapprochez les derniers paiements, les factures clients attendues et les justificatifs. Aucune échéance de paiement n’est déduite sans donnée confirmée.",href:"/dashboard?section=activite",when:"Cette semaine"});
 const activity=transactions?buildBriefActivity({date,transactions,settings:work,invoices,cash}):null;
 const trackedMonths=householdMonths.map(filterPiloteIncome).map(addPiloteMoroccoRent);
 const trackedMonth=trackedMonths.find(m=>m.month===month);
 const compensations=trackedMonth?buildPiloteCompensations(trackedMonth,trackedMonths).filter(f=>f.expenses>0||f.income>0):[];
 const deficits=compensations.filter(f=>f.id!=="other"&&f.balance<0).sort((a,b)=>a.balance-b.balance);
 const guidance:Record<string,string>={rent:"Vérifiez les loyers compensatoires reçus et les charges logement ; prévoyez le complément à financer.",food:"Vérifiez les contributions reçues, puis adaptez les achats restants au complément que vous pouvez financer.",transport:"Rapprochez les déplacements professionnels réellement effectués et les IK déjà remboursées avant toute nouvelle demande.",ndf:"Rapprochez les frais professionnels réels, les justificatifs transmis et les remboursements reçus ; ne les comptez pas deux fois."};
 for(const family of deficits)items.push({id:`compensation-${family.id}`,scope:"foyer",priority:"attention",title:`${family.name} : ${euro(-family.balance)} à financer`,detail:`${euro(family.income)} de compensations suivies pour ${euro(family.expenses)} de dépenses. ${guidance[family.id]}`,href:"/dashboard?section=pilote",when:"Cette semaine"});
 const next=activity?.nextInvoice,treasury=activity?.treasury;
 if(treasury&&treasury.shortfall>0)items.unshift({id:"treasury172",scope:"pro",priority:"attention",title:next&&treasury.projectedShortfall===0?"L’encaissement attendu couvrirait la réserve à 17,2 %":"Conserver une réserve de trésorerie",detail:`Il manque aujourd’hui ${euro(treasury.shortfall)} pour couvrir le scénario CSG 17,2 % + TVA.${next?` Après ${next.kind==="estimate"?"facturation estimée puis ":""}encaissement de ${euro(next.amountHt)} HT, le manque serait de ${euro(treasury.projectedShortfall??0)}, TVA et réserve supplémentaire incluses.`:" Vérifiez les prochains encaissements avant un versement personnel ou une dépense facultative."}`,href:"/dashboard?section=sasu&scope=pro",when:"Aujourd’hui"});
 if(next?.kind==="issued")items.unshift({id:"invoice-followup",scope:"pro",priority:next.dueDate&&next.dueDate<date?"attention":"action",title:next.dueDate&&next.dueDate<date?"Vérifier le règlement de la facture échue":"Suivre le prochain encaissement",detail:`${euro(next.amountHt)} HT restant à rapprocher${next.dueDate?`, échéance indiquée : ${next.dueDate}`:" ; aucune date de paiement confirmée"}. Contrôlez le rapprochement bancaire avant de relancer.`,href:"/dashboard?section=activite",when:"Aujourd’hui"});
 if(next?.kind==="estimate")items.push({id:"prepare-invoice",scope:"pro",priority:"action",title:"Préparer la prochaine facture",detail:`${next.days} jours saisis pour ${euro(next.amountHt)} HT estimés sur le mois. Confirmez les jours futurs et le TJM avant émission ; ce montant n’est pas encore une créance.`,href:"/dashboard?section=activite",when:"Cette semaine"});
 const year=date.slice(0,4),yearRows=proRows.filter(t=>t.date.startsWith(year));
 const gifts=yearRows.filter(t=>t.amount<0&&/cadeau|gift/i.test(`${t.category} ${t.label}`));
 const opportunities:BriefOpportunity[]=pro?[
  {id:"client-gifts",title:gifts.length?"Faire le point sur les cadeaux clients":"Préparer des cadeaux clients utiles",detail:gifts.length?`${gifts.length} opération(s) repérée(s) cette année. Vérifiez les bénéficiaires, l’intérêt commercial, les factures et les règles cadeaux du client avant d’en prévoir d’autres.`:"Si une occasion commerciale réelle le justifie, identifiez les clients concernés et un cadeau proportionné (livre métier, attention de fin d’année…). Conservez le bénéficiaire, le motif et la facture ; vérifiez aussi la politique cadeaux du client.",href:"/dashboard?section=sasu&scope=pro"},
  {id:"recover-costs",title:"Retrouver les frais pro déjà avancés",detail:"Reprenez les repas de travail, transports, parkings et péages réellement liés à une mission. Rassemblez date, motif et justificatif ; vérifiez qu’ils ne sont ni déjà remboursés ni pris en charge autrement.",href:"/dashboard?section=private"},
  {id:"tools-training",title:"Investir dans ce qui aide la prochaine mission",detail:"Listez un besoin concret de formation, de logiciel ou de matériel, puis vérifiez les outils et abonnements déjà disponibles. N’engagez l’achat que s’il apporte une utilité réelle et reste compatible avec la réserve de trésorerie.",href:"/dashboard?section=sasu&scope=pro"},
  {id:"mixed-costs",title:"Vérifier la part pro des frais mixtes",detail:"Téléphone, internet ou espace de travail : faites vérifier la répartition professionnelle documentée et le traitement comptable. La part personnelle ne devient pas une charge pro parce qu’elle est payée par DigitPro.",href:"/dashboard?section=private"}
 ]:[];
 if(treasury&&treasury.shortfall>0)for(const idea of opportunities.filter(i=>["client-gifts","tools-training"].includes(i.id)))idea.detail="Préparez cette piste sans engager l’achat tant que la réserve de trésorerie reste insuffisante. "+idea.detail;
 if(invoices?.some(i=>i.amountKind==="inconnu"||i.amountEur===null||!Number.isFinite(i.amountEur)))notices.push("Des factures au montant HT/TTC indéterminé empêchent de confirmer la couverture de trésorerie.");
 const yearComparison=activity?.yearChangePercent==null?"Le comparatif avec l’an dernier manque encore.":`${activity.yearChangePercent>=0?"En avance":"En retrait"} de ${Math.abs(activity.yearChangePercent).toLocaleString("fr-FR",{maximumFractionDigits:1})} % sur l’an dernier à la même date (${euro(activity.previousYearRevenueHt!)} HT).`;
 const activityText=activity?`${activity.workedMonth===null?"Calendrier de travail indisponible":`${activity.workedMonth} jours réalisés ce mois${activity.plannedMonth?` et ${activity.plannedMonth} encore planifiés`:""}, ${activity.workedYear} depuis janvier`}. Le CA encaissé atteint ${euro(activity.yearRevenueHt)} HT cette année. ${yearComparison}`:"Le suivi de votre activité est temporairement indisponible.";
 const treasuryText=treasury?`La trésorerie de ${euro(treasury.cash)} ${treasury.shortfall>0?`laisse ${euro(treasury.shortfall)} à couvrir`:"couvre la réserve suivie"} dans le scénario CSG 17,2 % + TVA.${next?` ${next.kind==="issued"?"La facture en attente de":"La prochaine facture estimée à"} ${euro(next.amountHt)} HT ${treasury.projectedShortfall===0?`porterait la marge après réserve à ${euro(Math.max(0,treasury.projectedMargin??0))}`:`laisserait encore ${euro(treasury.projectedShortfall??0)} à couvrir`} après encaissement.`:" Aucun encaissement de facture identifié à projeter."}`:"La sécurisation à 17,2 % ne peut pas être calculée avec les sources actuellement disponibles.";
 const householdText=compensations.length?deficits.length?`${deficits.map(f=>f.name).join(", ")} : ces postes ne sont pas entièrement compensés. Reste à financer : ${euro(deficits.reduce((n,f)=>n-f.balance,0))}, sans utiliser les excédents des autres familles.`:"Les compensations suivies couvrent les familles logement, alimentation, transport et NDF renseignées. Les autres dépenses restent à financer séparément.":"Actualisez Pilote pour connaître les dépenses du foyer et leurs compensations.";
 return {activity,summary:{activity:activityText,treasury:treasuryText,household:householdText},compensations,opportunities,date,month,pro,household,items:items.sort((a,b)=>({attention:0,action:1,info:2}[a.priority]-{attention:0,action:1,info:2}[b.priority])),warnings:notices};
}
