import { buildPiloteMonths, filterPiloteExpenses, isPiloteReportRow, piloteReportingMonth, type BankinPiloteSnapshot, type PiloteExpenseView, type PiloteMonth } from "@/lib/pilote";

export type PiloteComparisonAtDate = { asOf: string; months: PiloteMonth[] };
export type PiloteComparisonPeriod = { month: string; start: string; end: string; expenses: number };
export type PiloteMonthlyComparison =
  | { status: "unavailable"; reason: "future" | "missing-month" | "missing-daily" }
  | { status: "ready"; current: PiloteComparisonPeriod; previous: PiloteComparisonPeriod; delta: number; percent: number | null; atDate: boolean; categories: { name: string; current: number; previous: number; delta: number }[]; otherDelta: number };

const cents = (value: number) => Math.round(value * 100);
const monthDays = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export function previousPiloteCalendarMonth(month: string) {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
}
function throughDate(month: string, throughDay?: number) {
  return `${month}-${String(Math.min(throughDay ?? monthDays(month), monthDays(month))).padStart(2, "0")}`;
}

/** Only two aggregate months leave the server; never source rows or transaction identities. */
export function buildPiloteComparisonAtDate(snapshot: BankinPiloteSnapshot, asOf: string): PiloteComparisonAtDate | null {
  if (!snapshot.rows) return null;
  const current = asOf.slice(0, 7), previous = previousPiloteCalendarMonth(current), throughDay = Number(asOf.slice(8, 10));
  const rows = snapshot.rows.filter(row => {
    if (!isPiloteReportRow(row)) return false;
    const reportingMonth = piloteReportingMonth(row);
    if (reportingMonth !== current && reportingMonth !== previous) return false;
    // A late rent belongs to day one of its reporting month, exactly as in the daily chart.
    const reportingDay = reportingMonth === row.date.slice(0, 7) ? Number(row.date.slice(8, 10)) : 1;
    return reportingDay <= Math.min(throughDay, monthDays(reportingMonth));
  });
  return { asOf, months: buildPiloteMonths(rows) };
}

/** Compare expense totals only, using the same views and adjacent calendar periods. */
export function buildPiloteMonthlyComparison(months: PiloteMonth[], month: string, views: readonly PiloteExpenseView[], today: string, atDateData?: PiloteComparisonAtDate | null): PiloteMonthlyComparison {
  if (!month || month > today.slice(0, 7)) return { status: "unavailable", reason: "future" };
  const previousMonth = previousPiloteCalendarMonth(month), atDate = month === today.slice(0, 7);
  if (atDate && (!atDateData || atDateData.asOf !== today)) return { status: "unavailable", reason: "missing-daily" };
  const source = atDate ? atDateData!.months : months;
  const currentSource = source.find(value => value.month === month), previousSource = source.find(value => value.month === previousMonth);
  if (!currentSource || !previousSource) return { status: "unavailable", reason: "missing-month" };
  const current = filterPiloteExpenses(currentSource, views), previous = filterPiloteExpenses(previousSource, views);
  const allNames = new Set([...current.categories.map(category => category.name), ...previous.categories.map(category => category.name)]);
  const contributions = [...allNames].map(name => {
    const currentCents = cents(current.categories.find(category => category.name === name)?.expenses ?? 0);
    const previousCents = cents(previous.categories.find(category => category.name === name)?.expenses ?? 0);
    return { name, current: currentCents / 100, previous: previousCents / 100, delta: (currentCents - previousCents) / 100 };
  }).filter(category => category.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name, "fr"));
  const currentCents = cents(current.expenses), previousCents = cents(previous.expenses), deltaCents = currentCents - previousCents;
  const period = (value: PiloteMonth): PiloteComparisonPeriod => ({ month: value.month, start: `${value.month}-01`, end: throughDate(value.month, atDate ? Number(today.slice(8, 10)) : undefined), expenses: value.expenses });
  return { status: "ready", current: period(current), previous: period(previous), delta: deltaCents / 100, percent: previousCents > 0 ? deltaCents / previousCents * 100 : null, atDate, categories: contributions.slice(0, 3), otherDelta: (deltaCents - contributions.slice(0, 3).reduce((sum, category) => sum + cents(category.delta), 0)) / 100 };
}

export type PiloteComparisonPoint={day:number;current:number|null;previous:number|null};
/** Daily cumulative expenses on one shared day axis; never invent a missing daily history. */
export function buildPiloteComparisonEvolution(comparison:PiloteMonthlyComparison,daily:import("./pilote-daily").PiloteDaily|null|undefined,views:readonly PiloteExpenseView[]):PiloteComparisonPoint[]|null{
 if(comparison.status!=="ready"||!daily)return null;
 const current=daily[comparison.current.month],previous=daily[comparison.previous.month];
 const currentEnd=Number(comparison.current.end.slice(8)),previousEnd=Number(comparison.previous.end.slice(8));
 if(!current||!previous||current.length<currentEnd||previous.length<previousEnd)return null;
 const selected=[...new Set(views)];let a=0,b=0;
 const points=Array.from({length:Math.max(currentEnd,previousEnd)},(_,index)=>{
  const day=index+1;
  if(day<=currentEnd)a+=selected.reduce((sum,view)=>sum+cents(current[index][view]??0),0);
  if(day<=previousEnd)b+=selected.reduce((sum,view)=>sum+cents(previous[index][view]??0),0);
  return {day,current:day<=currentEnd?a/100:null,previous:day<=previousEnd?b/100:null};
 });
 // An inconsistent/stale response must not draw curves contradicting the comparison totals.
 if(a!==cents(comparison.current.expenses)||b!==cents(comparison.previous.expenses))return null;
 return points;
}
