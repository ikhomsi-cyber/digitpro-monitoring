import { isPiloteReportRow, buildPiloteMonths, filterPiloteIncome, piloteExpenseView, piloteReportingMonth, type BankinPiloteSnapshot, type PiloteExpenseView } from "@/lib/pilote";
export type PiloteDay = { day: number; income: number; essential: number; secondary: number; travel: number; taxes?: number };
export type PiloteDaily = Record<string, PiloteDay[]>;
/** Daily amounts only: no labels, accounts or transaction identities leave the server. */
export function buildPiloteDaily(snapshot: BankinPiloteSnapshot): PiloteDaily | null {
  if (!snapshot.rows) return null;
  const result: PiloteDaily = {};
  const allowedIncome = new Set(buildPiloteMonths(snapshot.rows).map(filterPiloteIncome).flatMap(month => month.incomeCategories.flatMap(parent => parent.children.map(child => JSON.stringify([month.month, parent.name, child.name])))));
  for (const month of snapshot.months) {
    const [year, number] = month.month.split("-").map(Number);
    result[month.month] = Array.from({ length: new Date(Date.UTC(year, number, 0)).getUTCDate() }, (_, i) => ({ day: i + 1, income: i === 0 && month.month >= "2024-04" ? 300 : 0, essential: 0, secondary: 0, taxes: 0, travel: 0 }));
  }
  // Reuse the exact report exclusions, including the explicitly reimbursed expense.
  const seen = new Map<string, Set<number>>();
  for (const row of snapshot.rows) {
    if (!isPiloteReportRow(row)) continue;
    const month = piloteReportingMonth(row);
    const monthRows=seen.get(month)??new Set<number>();
    if(monthRows.has(row.sourceRow))continue;
    monthRows.add(row.sourceRow);seen.set(month,monthRows);
    const day = month === row.date.slice(0, 7) ? Number(row.date.slice(8, 10)) : 1;
    const target = result[month]?.[day - 1];
    if (!target) continue;
    if (row.amount > 0) {
      if (allowedIncome.has(JSON.stringify([month, row.parentCategory || "Sans catégorie", row.subCategory || "Sans sous-catégorie"]))) target.income = Math.round((target.income + row.amount) * 100) / 100;
    } else {
      const view = piloteExpenseView(row.parentCategory, row.subCategory);
      target[view] = Math.round(((target[view] ?? 0) - row.amount) * 100) / 100;
    }
  }
  return result;
}
export function cumulativePiloteDays(days: PiloteDay[], views: PiloteExpenseView[], throughDay = days.length) {
  let income = 0, expenses = 0;
  return days.slice(0, throughDay).map(row => {
    income += Math.round(row.income * 100);
    expenses += views.reduce((sum, view) => sum + Math.round((row[view] ?? 0) * 100), 0);
    return { day: row.day, income: income / 100, expenses: expenses / 100, balance: (income - expenses) / 100 };
  });
}
