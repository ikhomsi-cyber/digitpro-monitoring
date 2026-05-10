/**
 * Synchronisation des transactions via l’API Business Qonto (v2).
 * @see https://docs.qonto.com/get-started/business-api/authentication/api-key
 */

import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";

export type QontoImportRow = {
  date: string;
  label: string;
  category: string;
  amount: number;
  balance: number | null;
  company: string;
  scope?: "pro" | "personal";
};

type QontoMeta = {
  current_page: number;
  next_page: number | null;
  prev_page: number | null;
  total_pages: number;
  total_count: number;
  per_page: number;
};

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function qontoAuthHeader(): string {
  const login = getEnv("QONTO_LOGIN");
  const secret = getEnv("QONTO_SECRET_KEY");
  if (!login || !secret) {
    throw new Error(
      "Variables QONTO_LOGIN et QONTO_SECRET_KEY requises (Intégrations → Clé API Qonto). Voir .env.example."
    );
  }
  return `${login}:${secret}`;
}

function qontoBaseUrl(): string {
  return (getEnv("QONTO_API_BASE_URL") || "https://thirdparty.qonto.com").replace(/\/$/, "");
}

async function qontoFetchJson<T>(path: string, searchParams?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(path, `${qontoBaseUrl()}/`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: qontoAuthHeader(),
    Accept: "application/json"
  };
  const staging = getEnv("QONTO_STAGING_TOKEN");
  if (staging) headers["X-Qonto-Staging-Token"] = staging;

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Qonto ${res.status} — ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

type BankAccount = {
  id?: string;
  iban?: string;
  slug?: string;
  name?: string;
  currency?: string;
  status?: string;
  main?: boolean;
};

type OrganizationResponse = {
  organization?: {
    bank_accounts?: BankAccount[];
    name?: string;
    legal_name?: string;
  };
};

function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

function pickBankAccount(accounts: BankAccount[]): BankAccount {
  if (!accounts.length) {
    throw new Error("Aucun compte bancaire Qonto trouvé pour cette organisation.");
  }

  const id = getEnv("QONTO_BANK_ACCOUNT_ID");
  if (id) {
    const found = accounts.find((a) => a.id === id);
    if (found) return found;
    throw new Error(`QONTO_BANK_ACCOUNT_ID introuvable parmi les comptes de l’organisation.`);
  }

  const ibanEnv = getEnv("QONTO_IBAN");
  if (ibanEnv) {
    const want = normalizeIban(ibanEnv);
    const found = accounts.find((a) => a.iban && normalizeIban(a.iban) === want);
    if (found) return found;
    throw new Error(`QONTO_IBAN ne correspond à aucun compte listé par Qonto.`);
  }

  const activeEur = accounts.filter(
    (a) => a.status !== "closed" && (a.currency ?? "EUR").toUpperCase() === "EUR"
  );
  const pool = activeEur.length ? activeEur : accounts;
  const main = pool.find((a) => a.main);
  return main ?? pool[0];
}

function companyLabelForAccount(account: BankAccount): string {
  const rawName = (account.name ?? "").trim();
  const base = rawName || account.slug?.replace(/-/g, " ") || "Qonto";
  if (/qonto/i.test(base)) return base;
  return `${base} (Qonto)`;
}

function humanizeCategorySlug(slug: string): string {
  const s = slug.trim();
  if (!s) return "";
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function mapTransaction(
  raw: Record<string, unknown>,
  company: string,
  scope: "pro" | "personal"
): QontoImportRow | null {
  const settledAt = raw.settled_at;
  if (typeof settledAt !== "string" || settledAt.length < 10) return null;

  const date = settledAt.slice(0, 10);
  const amountNum = Number(raw.amount);
  if (!Number.isFinite(amountNum)) return null;

  const side = String(raw.side || "").toLowerCase();
  const signed = side === "credit" ? Math.abs(amountNum) : -Math.abs(amountNum);

  const cf = raw.cashflow_category as { name?: string } | undefined;
  const cashflowName = typeof cf?.name === "string" ? cf.name.trim() : "";
  const apiCategory = typeof raw.category === "string" ? raw.category.trim() : "";
  const categoryRaw =
    cashflowName || humanizeCategorySlug(apiCategory) || humanizeCategorySlug(String(raw.operation_type || "")) || "Qonto";
  const category = mapExpenseCategoryLabel(categoryRaw);

  let label = typeof raw.label === "string" ? raw.label.trim() : "";
  const reference = raw.reference;
  if (reference != null && String(reference).trim()) {
    const r = String(reference).trim();
    label = label ? `${label} · ${r}` : r;
  }
  if (!label) {
    label = humanizeCategorySlug(String(raw.operation_type || "Opération"));
  }

  let balance: number | null = null;
  if (raw.settled_balance != null && Number.isFinite(Number(raw.settled_balance))) {
    balance = Number(raw.settled_balance);
  }

  return { date, label, category, amount: signed, balance, company, scope };
}

export type QontoSyncResult = {
  rows: QontoImportRow[];
  bankAccountSummary: string;
};

/**
 * Récupère toutes les transactions « completed » (comportement par défaut Qonto) pour le compte configuré.
 */
export async function fetchQontoTransactionsForImport(): Promise<QontoSyncResult> {
  const orgJson = await qontoFetchJson<OrganizationResponse>("/v2/organization");
  const accounts = orgJson.organization?.bank_accounts ?? [];
  const account = pickBankAccount(accounts);
  const company = companyLabelForAccount(account);

  const iban = account.iban?.replace(/\s/g, "");
  const bankAccountId = account.id;

  const scopeEnv = getEnv("QONTO_IMPORT_SCOPE");
  const scope: "pro" | "personal" = scopeEnv === "personal" ? "personal" : "pro";

  const queryBase: Record<string, string | undefined> = {
    per_page: "100",
    status: "completed"
  };
  if (bankAccountId) queryBase.bank_account_id = bankAccountId;
  else if (iban) queryBase.iban = iban;
  else throw new Error("Compte Qonto sans id ni IBAN : impossible de lister les transactions.");

  const rows: QontoImportRow[] = [];
  let page = 1;
  let guard = 0;

  for (;;) {
    const json = await qontoFetchJson<{ transactions: Record<string, unknown>[]; meta: QontoMeta }>(
      "/v2/transactions",
      { ...queryBase, page: String(page) }
    );
    const list = json.transactions ?? [];
    for (const tx of list) {
      const row = mapTransaction(tx, company, scope);
      if (row) rows.push(row);
    }
    const meta = json.meta;
    const next = meta?.next_page;
    if (next == null || next === page) break;
    page = next;
    guard++;
    if (guard > 500) break;
  }

  const summary = `${company}${iban ? ` · ${iban.slice(0, 4)}…${iban.slice(-4)}` : bankAccountId ? ` · ${bankAccountId.slice(0, 8)}…` : ""}`;

  return { rows, bankAccountSummary: summary };
}
