export type BankinPiloteRow = { sourceRow: number; identity?: string; date: string; amount: number; parentCategory: string; subCategory: string; hidden: boolean };

export type PiloteGroup = { name: string; expenses: number; income: number; count: number; children: PiloteGroup[] };
export type PiloteMonth = { month: string; expenses: number; income: number; balance: number; count: number; categories: PiloteGroup[]; incomeCategories: PiloteGroup[] };
const cents = (n: number) => Math.round(n * 100);

/** Original Bankin fields with the user's explicit late-rent reporting rule. */
export function piloteReportingMonth(row: BankinPiloteRow): string {
  const original = row.date.slice(0, 7);
  const date = new Date(`${row.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.date) return original;
  if (row.amount <= 0 || ![row.parentCategory, row.subCategory].some(name => /\bloyers?\b/.test(sourceName(name)))) return original;
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return date.getUTCDate() >= lastDay - 6 ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 7) : original;
}

/** Explicitly confirmed by the user: the cancelled Minorque hotel debit. */
function isConfirmedReimbursedExpense(row: BankinPiloteRow): boolean {
  return row.date === "2026-07-09" && row.parentCategory === "Voyage Minorque 26"
    && row.subCategory === "Hôtel - 14j" && cents(row.amount) === -131520;
}

/** Upgrade the previously saved aggregate without requiring another import.
 * New snapshots exclude the exact source row and carry version 2, so this
 * adjustment is never applied to them a second time.
 */
export function piloteSnapshotMonths(snapshot: BankinPiloteSnapshot): PiloteMonth[] {
  if (snapshot.version === 2) return snapshot.months;
  return snapshot.months.map(month => {
    if (month.month !== "2026-07") return month;
    const parent = month.categories.find(group => group.name === "Voyage Minorque 26");
    const child = parent?.children.find(group => group.name === "Hôtel - 14j");
    if (!parent || !child || cents(child.expenses) < 131520) return month;
    const categories = month.categories.map(group => group !== parent ? group : {
      ...group, expenses: (cents(group.expenses) - 131520) / 100, count: Math.max(0, group.count - 1),
      children: group.children.map(sub => sub !== child ? sub : {...sub, expenses: (cents(sub.expenses) - 131520) / 100, count: Math.max(0, sub.count - 1)}),
    });
    return {...month, categories, expenses: (cents(month.expenses) - 131520) / 100,
      balance: (cents(month.balance) + 131520) / 100, count: Math.max(0, month.count - 1)};
  });
}

/** Shared report eligibility; daily charts must use precisely the same exclusions. */
export function isPiloteReportRow(row: BankinPiloteRow): boolean {
  if(isConfirmedReimbursedExpense(row)||bankinPiloteExclusion(row)||!Number.isFinite(row.amount)||!/^\d{4}-\d{2}-\d{2}$/.test(row.date))return false;
  const date=new Date(`${row.date}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===row.date;
}

/** No inferred labels, category mappings or app transactions. */
export function buildPiloteMonths(transactions: BankinPiloteRow[]): PiloteMonth[] {
  const months = new Map<string, { rows: BankinPiloteRow[]; ids: Set<number> }>();
  for (const tx of transactions) {
    if (!isPiloteReportRow(tx)) continue;
    const month = piloteReportingMonth(tx);
    const entry = months.get(month) ?? { rows: [], ids: new Set<number>() };
    if (entry.ids.has(tx.sourceRow)) continue;
    entry.ids.add(tx.sourceRow); entry.rows.push(tx); months.set(month, entry);
  }
  return [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, { rows }]) => {
    const expenses = rows.reduce((sum, tx) => sum + (tx.amount < 0 ? -cents(tx.amount) : 0), 0) / 100;
    const income = rows.reduce((sum, tx) => sum + (tx.amount > 0 ? cents(tx.amount) : 0), 0) / 100;
    const group = (positive: boolean): PiloteGroup[] => {
      const parents = new Map<string, Map<string, { amount: number; count: number }>>();
      for (const tx of rows) {
        if (tx.amount === 0 || (tx.amount > 0) !== positive) continue;
        const parent = tx.parentCategory || "Sans catégorie";
        const sub = tx.subCategory || "Sans sous-catégorie";
        const children = parents.get(parent) ?? new Map();
        const value = children.get(sub) ?? { amount: 0, count: 0 };
        value.amount += Math.abs(cents(tx.amount)); value.count++;
        children.set(sub, value); parents.set(parent, children);
      }
      return [...parents].map(([name, children]) => {
        const parts = [...children].map(([name, value]) => ({ name, expenses: positive ? 0 : value.amount / 100, income: positive ? value.amount / 100 : 0, count: value.count, children: [] }));
        parts.sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income) || a.name.localeCompare(b.name));
        return { name, expenses: parts.reduce((s, p) => s + cents(p.expenses), 0) / 100, income: parts.reduce((s, p) => s + cents(p.income), 0) / 100, count: parts.reduce((s, p) => s + p.count, 0), children: parts };
      }).sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income) || a.name.localeCompare(b.name));
    };
    return { month, expenses, income, balance: (cents(income) - cents(expenses)) / 100, count: rows.length, categories: group(false), incomeCategories: group(true) };
  });
}


const sourceName = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\.\s*$/, "");
export function bankinPiloteExclusion(row: BankinPiloteRow): "hidden" | "internal" | null {
  const names = [row.parentCategory, row.subCategory].map(sourceName);
  if (row.hidden || names.some(name => ["transaction masquee", "transactions masquees"].includes(name))) return "hidden";
  if (names.some(name => ["virement interne", "virements internes"].includes(name))) return "internal";
  return null;
}
export type BankinPiloteSnapshot = { version: 1 | 2; months: PiloteMonth[]; sourceFilename: string; fileHash: string; sourceRows: number; excludedInternal: number; excludedHidden: number; shiftedRentCount?: number; importedAt: string; rows?: BankinPiloteRow[]; rowsCompressed?: string; legacyBackup?: BankinPiloteSnapshot };
export function buildBankinPiloteSnapshot(rows: BankinPiloteRow[], sourceFilename: string, fileHash: string): BankinPiloteSnapshot {
  return { version: 2, rows, months: buildPiloteMonths(rows), shiftedRentCount: rows.filter(row => !bankinPiloteExclusion(row) && piloteReportingMonth(row) !== row.date.slice(0, 7)).length, sourceFilename, fileHash, sourceRows: rows.length, excludedInternal: rows.filter(row => bankinPiloteExclusion(row) === "internal").length, excludedHidden: rows.filter(row => bankinPiloteExclusion(row) === "hidden").length, importedAt: new Date().toISOString() };
}

export type PiloteCompensationFamily = "rent" | "transport" | "ndf" | "food" | "other";
export type PiloteCompensation = { id: PiloteCompensationFamily; name: string; source: string; target: string; income: number; expenses: number; covered: number; balance: number; incomeNames: string[]; expenseNames: string[] };
const compensationNames = {
  rent: { name: "Logement & LMNP", source: "Loyers reçus", target: "Logement + charges LMNP" },
  transport: { name: "Transport", source: "DigitPro IK", target: "Auto & transports" },
  ndf: { name: "Notes de frais", source: "DigitPro NDF", target: "NDF DigitPro" },
  food: { name: "Alimentation", source: "Meryeme", target: "Alimentation & restauration" },
  other: { name: "Le reste", source: "Autres rentrées", target: "Autres dépenses" },
} satisfies Record<PiloteCompensationFamily, { name: string; source: string; target: string }>;

/** The user's explicit budget rules, evaluated only on original Bankin category names. */
export function piloteCompensationFamily(parent: string, sub: string, income: boolean): PiloteCompensationFamily {
  const name = sourceName(`${parent} ${sub}`);
  if (/\bdigitpro\b/.test(name) && /\bndf\b/.test(name)) return "ndf";
  if (income) {
    if (/\bdigitpro\b/.test(name) && /\bik\b/.test(name)) return "transport";
    if (/\bloyers?\b/.test(name)) return "rent";
    if (/\bmeryeme?\b/.test(name)) return "food";
  } else {
    if (/\blogement\b|\bloyers?\b|\blmnp?\b/.test(name)) return "rent";
    if (/\btransports?\b/.test(name)) return "transport";
    if (/\balimentation\b/.test(name)) return "food";
  }
  return "other";
}

export function piloteIncomeFamily(month: string, parent: string, sub: string, amount: number): PiloteCompensationFamily {
  // Explicit user correction: the €500 in Bankin “Extra” in October 2026 is Meryeme.
  if (month === "2026-10" && sourceName(sub) === "extra" && cents(amount) === 50000) return "food";
  // Explicit user correction: the two Extra credits in September 2026 are Meryeme.
  if (month === "2026-09" && sourceName(sub) === "extra") return "food";
  return piloteCompensationFamily(parent, sub, true);
}

export function buildPiloteCompensations(month: PiloteMonth, sourceMonths: PiloteMonth[] = [month]): PiloteCompensation[] {
  const result = (Object.keys(compensationNames) as PiloteCompensationFamily[]).map(id => ({ id, ...compensationNames[id], income: 0, expenses: 0, covered: 0, balance: 0, incomeNames: [] as string[], expenseNames: [] as string[] }));
  const annualMonths = sourceMonths.filter(row => row.month.startsWith(`${month.month}-`));
  const incomeMonths = month.month.length === 4 && annualMonths.length ? annualMonths : [month];
  const sources = [...incomeMonths.map(row => ({ groups: row.incomeCategories, income: true, period: row.month })), { groups: month.categories, income: false, period: month.month }];
  for (const {groups, income, period} of sources) {
    for (const parent of groups) for (const sub of parent.children) {
      const family = result.find(row => row.id === (income ? piloteIncomeFamily(period, parent.name, sub.name, sub.income) : piloteCompensationFamily(parent.name, sub.name, false)))!;
      if (income) { family.income += cents(sub.income); family.incomeNames.push(sub.name); }
      else { family.expenses += cents(sub.expenses); family.expenseNames.push(`${parent.name} · ${sub.name}`); }
    }
  }
  return result.map(row => ({ ...row, income: row.income / 100, expenses: row.expenses / 100, covered: Math.min(row.income, row.expenses) / 100, balance: (row.income - row.expenses) / 100, incomeNames: [...new Set(row.incomeNames)], expenseNames: [...new Set(row.expenseNames)] }));
}

/** Adds the original Bankin monthly aggregates without reclassifying categories. */
export function buildPiloteYear(months: PiloteMonth[], year: string): PiloteMonth | undefined {
  const rows = months.filter(month => month.month.startsWith(`${year}-`));
  if (!rows.length) return undefined;
  const merge = (field: "categories" | "incomeCategories"): PiloteGroup[] => {
    const parents = new Map<string, Map<string, PiloteGroup>>();
    for (const month of rows) for (const parent of month[field]) {
      const children = parents.get(parent.name) ?? new Map<string, PiloteGroup>();
      for (const child of parent.children) {
        const value = children.get(child.name) ?? { name: child.name, expenses: 0, income: 0, count: 0, children: [] };
        value.expenses += cents(child.expenses); value.income += cents(child.income); value.count += child.count;
        children.set(child.name, value);
      }
      parents.set(parent.name, children);
    }
    return [...parents].map(([name, children]) => {
      const parts = [...children.values()].map(child => ({ ...child, expenses: child.expenses / 100, income: child.income / 100 })).sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income));
      return { name, expenses: parts.reduce((s, c) => s + cents(c.expenses), 0) / 100, income: parts.reduce((s, c) => s + cents(c.income), 0) / 100, count: parts.reduce((s, c) => s + c.count, 0), children: parts };
    }).sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income));
  };
  const income = rows.reduce((s, m) => s + cents(m.income), 0) / 100;
  const expenses = rows.reduce((s, m) => s + cents(m.expenses), 0) / 100;
  return { month: year, income, expenses, balance: (cents(income) - cents(expenses)) / 100, count: rows.reduce((s, m) => s + m.count, 0), categories: merge("categories"), incomeCategories: merge("incomeCategories") };
}

export type PiloteExpenseView = "essential" | "secondary" | "travel";
/** Display-only partitions; original Bankin labels and income remain unchanged. */
export function piloteExpenseView(parent: string, sub: string): PiloteExpenseView {
  if (piloteCompensationFamily(parent, sub, false) === "ndf") return "essential";
  const name = sourceName(`${parent} ${sub}`);
  if (/\b(voyages?|vacances?|sejours?)\b/.test(name)) return "travel";
  if (/\b(foncier(?:e)?s?|entretien|travaux|reparations?)\b/.test(name)) return "secondary";
  if (/\b(logement|loyers?|lmnp|copro|alimentation|transports?|sante|scolarite|enfants)\b/.test(name)) return "essential";
  return "secondary";
}
export function filterPiloteExpenses(month: PiloteMonth, view: PiloteExpenseView | readonly PiloteExpenseView[]): PiloteMonth {
  const views = new Set(typeof view === "string" ? [view] : view);
  const categories = month.categories.map(parent => {
    const children = parent.children.filter(sub => views.has(piloteExpenseView(parent.name, sub.name)));
    return {...parent, children, expenses: children.reduce((sum, sub) => sum + cents(sub.expenses), 0) / 100, count: children.reduce((sum, sub) => sum + sub.count, 0)};
  }).filter(parent => parent.children.length);
  const expenses = categories.reduce((sum, parent) => sum + cents(parent.expenses), 0) / 100;
  return {...month, categories, expenses, balance: (cents(month.income) - cents(expenses)) / 100};
}

/** User rule: unassigned income only contributes when Bankin categorizes it as cashback. */
export function filterPiloteIncome(month: PiloteMonth): PiloteMonth {
  const incomeCategories = month.incomeCategories.map(parent => {
    const children = parent.children.filter(sub => piloteIncomeFamily(month.month, parent.name, sub.name, sub.income) !== "other" || /\bcash\s*back\b/.test(sourceName(`${parent.name} ${sub.name}`)));
    return {...parent, children, income: children.reduce((sum, sub) => sum + cents(sub.income), 0) / 100, count: children.reduce((sum, sub) => sum + sub.count, 0)};
  }).filter(parent => parent.children.length);
  const income = incomeCategories.reduce((sum, parent) => sum + cents(parent.income), 0) / 100;
  return {...month, incomeCategories, income, balance: (cents(income) - cents(month.expenses)) / 100};
}


/** User-declared income, kept separate from the original Bankin categories. */
export function addPiloteMoroccoRent(month: PiloteMonth): PiloteMonth {
  if (!/^\d{4}-\d{2}$/.test(month.month) || month.month < "2024-04"
    || month.incomeCategories.some(group => group.name === "Loyer Maroc ajouté")) return month;
  const supplemental: PiloteGroup = {name:"Loyer Maroc ajouté",income:300,expenses:0,count:0,
    children:[{name:"Loyer Maroc",income:300,expenses:0,count:0,children:[]}]};
  return {...month,income:(cents(month.income)+30000)/100,balance:(cents(month.balance)+30000)/100,
    incomeCategories:[...month.incomeCategories,supplemental]};
}
