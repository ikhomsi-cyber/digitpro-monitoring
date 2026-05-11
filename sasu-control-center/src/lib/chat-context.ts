import {
  countsTowardDashboardExpenseTotal,
  effectiveRevenueAnalyticsDateIso,
  REVENUE_STAYS_IN_CURRENT_MONTH_THROUGH_DAY,
  type DashboardTx
} from "@/lib/dashboard-metrics";
import { deriveExpenseBucket } from "@/lib/derived-expense-bucket";
import { isRevenueCategory, revenueCounterpartyDisplayName } from "@/lib/revenue-category";
import { isPrimaryBankCompany, PRIMARY_BANK_LABEL } from "@/lib/bank";

/**
 * Builds a compact, LLM-friendly textual snapshot of the user's transactions.
 *
 * The format is designed to be cheap (token-wise) yet rich enough for the model
 * to answer free-form questions and run analyses without needing tool calls.
 *
 * Revenue / expense definitions match the dashboard KPI cards exactly:
 *   - revenue  = transactions whose category matches "Chiffre d'affaires"
 *                (see lib/revenue-category for matching rules)
 *   - expenses = sum of |amount| pour sorties (amount &lt; 0) hors buckets BNC et TVA
 *                (`countsTowardDashboardExpenseTotal`)
 */

/**
 * Max rows we include verbatim in the CSV block.
 *
 * Groq's free tier caps requests at 12 000 TPM (tokens per minute). The system
 * prompt + aggregates already eat ~1 000 tokens, the message history a few
 * hundred more, and each CSV row is ~12-15 tokens. 250 rows ≈ 3-4k tokens,
 * leaving comfortable head-room for the user message + the model's response.
 */
export const MAX_TX_FOR_CONTEXT = 250;

function fmtEur(n: number): string {
  return `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(2)}€`;
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type TxAggregate = {
  totalRevenueAllTime: number;
  totalExpensesAllTime: number;
  netAllTime: number;
  totalRevenue12mo: number;
  totalExpenses12mo: number;
  totalRevenue90d: number;
  totalExpenses90d: number;
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  latestBalance: { balance: number; on: string; label: string } | null;
};

function aggregateTotals(transactions: DashboardTx[], today: Date): TxAggregate {
  const cut12 = new Date(today.getTime());
  cut12.setUTCMonth(cut12.getUTCMonth() - 12);
  const cut90 = new Date(today.getTime());
  cut90.setUTCDate(cut90.getUTCDate() - 90);

  const cut12Iso = cut12.toISOString().slice(0, 10);
  const cut90Iso = cut90.toISOString().slice(0, 10);

  let totalRevenueAllTime = 0;
  let totalExpensesAllTime = 0;
  let totalRevenue12mo = 0;
  let totalExpenses12mo = 0;
  let totalRevenue90d = 0;
  let totalExpenses90d = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  let latestBalanceQonto: TxAggregate["latestBalance"] = null;
  let latestBalanceAny: TxAggregate["latestBalance"] = null;

  for (const t of transactions) {
    if (isRevenueCategory(t.category)) {
      totalRevenueAllTime += t.amount;
      const revDay = effectiveRevenueAnalyticsDateIso(t);
      if (revDay >= cut12Iso) totalRevenue12mo += t.amount;
      if (revDay >= cut90Iso) totalRevenue90d += t.amount;
    }
    if (countsTowardDashboardExpenseTotal(t)) {
      totalExpensesAllTime += Math.abs(t.amount);
      if (t.date >= cut12Iso) totalExpenses12mo += Math.abs(t.amount);
      if (t.date >= cut90Iso) totalExpenses90d += Math.abs(t.amount);
    }
    if (firstDate == null || t.date < firstDate) firstDate = t.date;
    if (lastDate == null || t.date > lastDate) lastDate = t.date;
    if (t.balance != null && Number.isFinite(t.balance)) {
      const candidate = { balance: t.balance, on: t.date, label: t.label };
      if (latestBalanceAny == null || t.date > latestBalanceAny.on) {
        latestBalanceAny = candidate;
      }
      if (
        isPrimaryBankCompany(t.company) &&
        (latestBalanceQonto == null || t.date > latestBalanceQonto.on)
      ) {
        latestBalanceQonto = candidate;
      }
    }
  }
  const latestBalance = latestBalanceQonto ?? latestBalanceAny;

  return {
    totalRevenueAllTime,
    totalExpensesAllTime,
    netAllTime: totalRevenueAllTime - totalExpensesAllTime,
    totalRevenue12mo,
    totalExpenses12mo,
    totalRevenue90d,
    totalExpenses90d,
    count: transactions.length,
    firstDate,
    lastDate,
    latestBalance
  };
}

function aggregateByMonth(transactions: DashboardTx[]) {
  const map = new Map<string, { revenue: number; expenses: number; count: number }>();

  const bump = (
    key: string,
    delta: { revenue?: number; expenses?: number; count?: number }
  ) => {
    const cur = map.get(key) ?? { revenue: 0, expenses: 0, count: 0 };
    if (delta.revenue != null) cur.revenue += delta.revenue;
    if (delta.expenses != null) cur.expenses += delta.expenses;
    if (delta.count != null) cur.count += delta.count;
    map.set(key, cur);
  };

  for (const t of transactions) {
    if (isRevenueCategory(t.category)) {
      bump(effectiveRevenueAnalyticsDateIso(t).slice(0, 7), {
        revenue: t.amount,
        count: 1
      });
    }
    if (countsTowardDashboardExpenseTotal(t)) {
      const expKey = t.date.slice(0, 7);
      bump(expKey, {
        expenses: Math.abs(t.amount),
        ...(isRevenueCategory(t.category) ? {} : { count: 1 })
      });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, 18);
}

function aggregateByCategory(transactions: DashboardTx[]) {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = deriveExpenseBucket(t);
    const cur = map.get(cat) ?? { total: 0, count: 0 };
    cur.total += Math.abs(t.amount);
    cur.count += 1;
    map.set(cat, cur);
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

function aggregateByCounterparty(transactions: DashboardTx[]) {
  const revMap = new Map<string, { total: number; count: number }>();
  const expMap = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (isRevenueCategory(t.category)) {
      const key = revenueCounterpartyDisplayName(t).slice(0, 80) || "—";
      const cur = revMap.get(key) ?? { total: 0, count: 0 };
      cur.total += t.amount;
      cur.count += 1;
      revMap.set(key, cur);
    } else if (t.amount < 0) {
      const key = (t.label ?? "").trim().slice(0, 80) || "—";
      const cur = expMap.get(key) ?? { total: 0, count: 0 };
      cur.total += Math.abs(t.amount);
      cur.count += 1;
      expMap.set(key, cur);
    }
  }
  const top = (m: typeof revMap) =>
    Array.from(m.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  return { topRevenue: top(revMap), topExpense: top(expMap) };
}

function asCsvBlock(transactions: DashboardTx[]): string {
  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );
  const limited = sorted.slice(0, MAX_TX_FOR_CONTEXT);
  // Compact headers + tighter label/company budgets to keep the prompt under
  // the Groq free-tier 12k TPM ceiling. Order is amount,balance,date,label,
  // category,company so the model sees numeric facts before long strings.
  const header = "amt,bal,d,lbl,cat,co";
  const rows = limited.map((t) =>
    [
      t.amount.toFixed(2),
      t.balance == null ? "" : t.balance.toFixed(2),
      t.date,
      csvEscape(t.label.slice(0, 50)),
      csvEscape(
        (t.amount < 0 ? deriveExpenseBucket(t) : (t.category ?? "")).slice(0, 24)
      ),
      csvEscape((t.company ?? "").slice(0, 24))
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export type ChatContext = {
  systemMessage: string;
  truncated: boolean;
  totalRows: number;
  rowsIncluded: number;
};

/**
 * Build the full system message that the API route will pass to the LLM.
 * Today's date is injected so the model can reason about "this month",
 * "last quarter", etc. Use the same TZ as the dashboard (UTC keys).
 */
export function buildChatContext(
  transactions: DashboardTx[],
  options: { todayIso?: string; userLabel?: string } = {}
): ChatContext {
  const today = options.todayIso
    ? new Date(`${options.todayIso}T00:00:00Z`)
    : new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const totals = aggregateTotals(transactions, today);
  const monthly = aggregateByMonth(transactions);
  const byCategory = aggregateByCategory(transactions);
  const { topRevenue, topExpense } = aggregateByCounterparty(transactions);

  const lines: string[] = [];
  lines.push("Tu es l’assistant financier intégré du dashboard DigitPro Consulting Monitoring.");
  lines.push("L’utilisateur dirige une petite société (SASU/portage) et te questionne sur sa comptabilité opérationnelle (entrées, sorties, chiffre d’affaires, trésorerie, fournisseurs, clients).");
  lines.push("");
  lines.push("Règles :");
  lines.push("- Réponds toujours en français, ton clair et concret, comme un comptable proche.");
  lines.push("- Utilise UNIQUEMENT les données ci-dessous. Si une info manque, dis-le honnêtement.");
  lines.push("- Mets en forme les chiffres en euros avec deux décimales et le signe correct (ex. 1 234,56 €).");
  lines.push("- Pour les listes/tableaux courts, utilise du markdown sobre (titres ##, listes -, tableaux | quand pertinent).");
  lines.push("- Quand tu cites une transaction, indique date + libellé + montant.");
  lines.push("- TVA par défaut : 20%. TJM cible par défaut : 820 € HT.");
  lines.push("- Les montants des transactions « Chiffre d’affaires » sont stockés en TTC. Pour obtenir le HT : montant_ttc / 1,20.");
  lines.push("- Le dashboard affiche le « Total revenue » en HT (CA HT). Quand l’utilisateur dit « CA » ou « Total revenue » sans précision, il parle du HT.");
  lines.push("- « Chiffre d’affaires » = transactions dont la catégorie commence par « Chiffre d’affaires » (singulier ou pluriel, accents tolérés).");
  lines.push(
    `- Encaissements CA positifs : jours 1 à ${REVENUE_STAYS_IN_CURRENT_MONTH_THROUGH_DAY} du mois civil → agrégés dans ce mois ; à partir du jour ${REVENUE_STAYS_IN_CURRENT_MONTH_THROUGH_DAY + 1} → rattachés analytiquement au 1er jour du mois suivant (filtres, graphiques, totaux) ; la date en base reste celle de la banque.`
  );
  lines.push("- « Dépenses » = toutes les transactions à montant négatif (toute sortie bancaire), peu importe la catégorie.");
  lines.push("- « Résultat net » = CA HT − Dépenses (les dépenses restent en TTC, simplification métier assumée).");
  lines.push(
    `- « Trésorerie / cash disponible » = colonne « Solde » de la transaction la plus récente sur le compte ${PRIMARY_BANK_LABEL}.`
  );
  lines.push(`- Date du jour (UTC) : ${todayIso}.`);
  if (options.userLabel) lines.push(`- Utilisateur : ${options.userLabel}.`);
  lines.push("");

  lines.push("# Synthèse globale");
  lines.push(`- Transactions au total : ${totals.count}`);
  if (totals.firstDate && totals.lastDate)
    lines.push(`- Période couverte : ${totals.firstDate} → ${totals.lastDate}`);
  const ht = (n: number) => n / 1.2;
  lines.push(
    `- CA total : ${fmtEur(ht(totals.totalRevenueAllTime))} HT (soit ${fmtEur(totals.totalRevenueAllTime)} TTC)`
  );
  lines.push(`- Dépenses totales : ${fmtEur(totals.totalExpensesAllTime)} TTC`);
  lines.push(
    `- Résultat net (CA HT − dépenses) : ${fmtEur(ht(totals.totalRevenueAllTime) - totals.totalExpensesAllTime)}`
  );
  lines.push(
    `- CA 12 derniers mois : ${fmtEur(ht(totals.totalRevenue12mo))} HT (soit ${fmtEur(totals.totalRevenue12mo)} TTC)`
  );
  lines.push(`- Dépenses 12 derniers mois : ${fmtEur(totals.totalExpenses12mo)} TTC`);
  lines.push(
    `- CA 90 derniers jours : ${fmtEur(ht(totals.totalRevenue90d))} HT (soit ${fmtEur(totals.totalRevenue90d)} TTC)`
  );
  lines.push(`- Dépenses 90 derniers jours : ${fmtEur(totals.totalExpenses90d)} TTC`);
  if (totals.latestBalance) {
    lines.push(
      `- Solde ${PRIMARY_BANK_LABEL} après dernière opération « ${totals.latestBalance.label} » au ${totals.latestBalance.on} : ${fmtEur(totals.latestBalance.balance)}`
    );
  } else {
    lines.push(
      `- Solde ${PRIMARY_BANK_LABEL} : non renseigné (aucune transaction ${PRIMARY_BANK_LABEL} avec colonne « Solde » importée).`
    );
  }
  lines.push("");

  if (monthly.length) {
    lines.push("# Mensuel (CA / dépenses, des plus récents au plus anciens)");
    lines.push("mois | CA | dépenses | nb tx");
    for (const [month, m] of monthly) {
      lines.push(`${month} | ${fmtEur(m.revenue)} | ${fmtEur(m.expenses)} | ${m.count}`);
    }
    lines.push("");
  }

  if (byCategory.length) {
    lines.push("# Top catégories (somme algébrique, |valeur|)");
    for (const c of byCategory) {
      lines.push(`- ${c.category} : ${fmtEur(c.total)} (${c.count} tx)`);
    }
    lines.push("");
  }

  if (topRevenue.length) {
    lines.push("# Top contreparties — Chiffre d’affaires");
    for (const r of topRevenue) {
      lines.push(`- ${r.label} : ${fmtEur(r.total)} (${r.count} tx)`);
    }
    lines.push("");
  }

  if (topExpense.length) {
    lines.push("# Top contreparties — dépenses");
    for (const e of topExpense) {
      lines.push(`- ${e.label} : ${fmtEur(e.total)} (${e.count} tx)`);
    }
    lines.push("");
  }

  const csvIncluded = Math.min(transactions.length, MAX_TX_FOR_CONTEXT);
  lines.push(
    `# Transactions détaillées (${csvIncluded}/${transactions.length} les plus récentes, format CSV)`
  );
  lines.push(
    "Colonnes : amt=montant TTC, bal=solde du compte, d=date YYYY-MM-DD, lbl=libellé, cat=bucket dépense dérivé (ou catégorie entrée), co=compte. Agrégats : Synthèse / Mensuel / Dépenses par bucket / Top contreparties."
  );
  lines.push("```csv");
  lines.push(asCsvBlock(transactions));
  lines.push("```");

  return {
    systemMessage: lines.join("\n"),
    truncated: transactions.length > MAX_TX_FOR_CONTEXT,
    totalRows: transactions.length,
    rowsIncluded: csvIncluded
  };
}
