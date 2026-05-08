export type MonthlyPoint = {
  month: string; // "Jan", "Fév", ...
  value: number;
  /** Clé YYYY-MM pour drill-down graphiques */
  monthKey?: string;
};

export type MonthlyMetric = {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
};

export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  category: "Clients" | "Outils" | "Banque" | "Charges" | "Impôts" | "Autres";
  amount: number; // positive = revenue, negative = expense
  company?: string;
};

export const monthlyRevenue: MonthlyPoint[] = [
  { month: "Jan", value: 12400 },
  { month: "Fév", value: 15300 },
  { month: "Mar", value: 17100 },
  { month: "Avr", value: 14850 },
  { month: "Mai", value: 19600 },
  { month: "Juin", value: 21400 },
  { month: "Juil", value: 18750 },
  { month: "Août", value: 16600 },
  { month: "Sep", value: 20500 },
  { month: "Oct", value: 23100 },
  { month: "Nov", value: 21950 },
  { month: "Déc", value: 26200 }
];

export const monthlyExpenses: MonthlyPoint[] = [
  { month: "Jan", value: 5400 },
  { month: "Fév", value: 6200 },
  { month: "Mar", value: 7000 },
  { month: "Avr", value: 6100 },
  { month: "Mai", value: 7600 },
  { month: "Juin", value: 8200 },
  { month: "Juil", value: 7400 },
  { month: "Août", value: 6800 },
  { month: "Sep", value: 8100 },
  { month: "Oct", value: 8600 },
  { month: "Nov", value: 8250 },
  { month: "Déc", value: 9100 }
];

export const transactions: Transaction[] = [
  {
    id: "tx_001",
    date: "2026-05-02",
    label: "Facture Client — Sprint produit",
    category: "Clients",
    amount: 4200
  },
  {
    id: "tx_002",
    date: "2026-05-03",
    label: "Abonnement Figma",
    category: "Outils",
    amount: -16
  },
  {
    id: "tx_003",
    date: "2026-05-04",
    label: "Stripe fees",
    category: "Banque",
    amount: -64
  },
  {
    id: "tx_004",
    date: "2026-05-05",
    label: "URSSAF — charges",
    category: "Charges",
    amount: -980
  },
  {
    id: "tx_005",
    date: "2026-05-05",
    label: "Facture Client — Support",
    category: "Clients",
    amount: 1350
  },
  {
    id: "tx_006",
    date: "2026-05-06",
    label: "Impôt sur les sociétés (acompte)",
    category: "Impôts",
    amount: -620
  }
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

function toYYYYMMUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  return `${y}-${m}`;
}

export function getMockMonthlyMetrics(now = new Date()): MonthlyMetric[] {
  // Generates the *last 12 months* ending at the current month.
  // Uses the existing demo values but aligns them to real YYYY-MM keys.
  const out: MonthlyMetric[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    const idx = (12 - 1 - i) % 12; // map into provided 12 demo points
    out.push({
      month: toYYYYMMUTC(d),
      revenue: monthlyRevenue[idx]?.value ?? 0,
      expenses: monthlyExpenses[idx]?.value ?? 0
    });
  }
  return out;
}

export function getMockTransactions(now = new Date()): Transaction[] {
  // Generate a richer, realistic “recent transactions” list around the current date.
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const daysAgo = (n: number) =>
    new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - n));

  const demoCompanyA = "SASU Démo";
  const demoCompanyB = "SASU Lab";

  const rows: Omit<Transaction, "id">[] = [
    { date: toIsoDateUTC(daysAgo(1)), label: "Facture Client — Forfait mensuel", category: "Clients", amount: 4800, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(2)), label: "Google Workspace", category: "Outils", amount: -12, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(3)), label: "Stripe fees", category: "Banque", amount: -83, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(4)), label: "URSSAF — charges", category: "Charges", amount: -1120, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(5)), label: "Abonnement Notion", category: "Outils", amount: -10, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(7)), label: "Facture Client — Mission produit", category: "Clients", amount: 3200, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(9)), label: "Acompte IS", category: "Impôts", amount: -640, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(11)), label: "Assurance RC Pro", category: "Charges", amount: -34, company: demoCompanyA },
    { date: toIsoDateUTC(daysAgo(13)), label: "Virement client", category: "Clients", amount: 2100, company: demoCompanyB },
    { date: toIsoDateUTC(daysAgo(16)), label: "Frais bancaires", category: "Banque", amount: -9, company: demoCompanyB },
    { date: toIsoDateUTC(daysAgo(19)), label: "Matériel — clavier", category: "Autres", amount: -129, company: demoCompanyB },
    { date: toIsoDateUTC(daysAgo(22)), label: "Facture Client — Support", category: "Clients", amount: 1450, company: demoCompanyB }
  ];

  return rows.map((r, i) => ({
    id: `mock_tx_${String(i + 1).padStart(3, "0")}`,
    ...r
  }));
}

