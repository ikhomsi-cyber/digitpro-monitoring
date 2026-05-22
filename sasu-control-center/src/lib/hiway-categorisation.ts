import type { DashboardTx } from "@/lib/dashboard-metrics";

export const HIWAY_EXPENSE_CATEGORIES = [
  "Indemnités kilométriques",
  "CESU",
  "Repas d’affaires",
  "Abonnement Hiway",
  "Mutuelle",
  "Hiway compta",
  "Retraite",
  "PAS DSN",
  "Abonnement internet & mobile",
  "Repas du dirigeant",
  "Assurances",
  "Frais bancaires",
  "Paiement TVA",
  "Non catégorisé",
  "Abonnement logiciel"
] as const;

export type HiwayExpenseCategory = (typeof HIWAY_EXPENSE_CATEGORIES)[number];

export function foldHiwayText(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceText(tx: Pick<DashboardTx, "label" | "company" | "category">): string {
  return foldHiwayText(`${tx.label} ${tx.company} ${tx.category}`);
}

function labelText(tx: Pick<DashboardTx, "label">): string {
  return foldHiwayText(tx.label);
}

export function labelStartsWithDgfipTva(tx: Pick<DashboardTx, "label">): boolean {
  return /^dgfip\s*(?:·|\.|-|:)?\s*tva(?:\b|\d)/.test(labelText(tx));
}

function textLooksLikePasDsn(raw: string): boolean {
  const text = foldHiwayText(raw);
  return (
    /\bpasdsn\b/.test(text) ||
    /\bpas[-\s_]*dsn\b/.test(text) ||
    /\bdsn\b/.test(text) ||
    (/\bpas\b/.test(text) &&
      (text.includes("dgfip") ||
        text.includes("gfip") ||
        text.includes("prelevement") ||
        text.includes("prlv") ||
        text.includes("a la source") ||
        text.includes("retenue") ||
        text.includes("liberatoire") ||
        text.includes("dts")))
  );
}

function textLooksLikeIk(raw: string): boolean {
  const text = foldHiwayText(raw);
  return (
    /\bik\b/.test(text) ||
    (text.includes("indemnite") && text.includes("kilomet")) ||
    (text.includes("kilometrique") && text.includes("indemn")) ||
    text.includes("frais kilomet") ||
    text.includes("note kilomet") ||
    text.includes("mileage")
  );
}

function textLooksLikeSoftware(raw: string): boolean {
  const text = foldHiwayText(raw);
  return [
    "apple.com bill",
    "apple com bill",
    "cursor",
    "logiciel",
    "software",
    "saas",
    "github",
    "notion",
    "figma",
    "adobe",
    "microsoft 365",
    "office 365",
    "google workspace",
    "openai",
    "anthropic",
    "vercel",
    "cloudflare"
  ].some((kw) => text.includes(kw));
}

function textLooksLikeRetraite(raw: string): boolean {
  const text = foldHiwayText(raw);
  return [
    "retraite",
    "agirc",
    "arrco",
    "carcdsf",
    "ircantec",
    "retraite complementaire",
    "caisse de retraite",
    "cotisation retraite",
    "versement retraite",
    "malakoff",
    "humanis",
    "ag2r",
    "frais de personnel"
  ].some((kw) => text.includes(kw));
}

function textLooksLikeRepasAffaires(raw: string): boolean {
  const text = foldHiwayText(raw);
  return (
    text.includes("repas d affaire") ||
    text.includes("dejeuner d affaire") ||
    text.includes("dejeuner affaire") ||
    text.includes("diner d affaire") ||
    text.includes("diner affaire") ||
    text.includes("invitation client") ||
    text.includes("restaurant affaire") ||
    text.includes("depenses liees au marketing") ||
    text.includes("marketing expenses") ||
    (text.includes("restaurant") && (text.includes("affaire") || text.includes("invitation")))
  );
}

function textLooksLikeRepasDirigeant(raw: string): boolean {
  const text = foldHiwayText(raw);
  return (
    text.includes("repas dirigeant") ||
    text.includes("repas du dirigeant") ||
    text.includes("repas ilias") ||
    text.includes("restauration pro") ||
    text.includes("dejeuner") ||
    text.includes("frais de nourriture et boissons") ||
    text.includes("food and drink") ||
    /\bilias\b/.test(text)
  );
}

export function mapHiwayExpenseCategory(raw: string | null | undefined): HiwayExpenseCategory | null {
  const text = foldHiwayText(String(raw ?? ""));
  if (!text) return null;
  const aliases: Array<[HiwayExpenseCategory, string[]]> = [
    ["Indemnités kilométriques", ["indemnites kilometriques", "travel expenses", "frais de voyage", "mileage", "note ik"]],
    ["CESU", ["cesu"]],
    ["Repas d’affaires", ["repas d affaires", "depenses liees au marketing", "marketing expenses"]],
    ["Abonnement Hiway", ["abonnement hiway"]],
    ["Mutuelle", ["mutuelle"]],
    ["Hiway compta", ["hiway compta", "depenses administratives", "administrative expenses"]],
    ["Retraite", ["retraite", "frais de personnel"]],
    ["PAS DSN", ["pas dsn", "pasdsn", "dsn", "pas"]],
    ["Abonnement internet & mobile", ["abonnement internet mobile", "abonnement internet & mobile", "mobile et internet"]],
    ["Repas du dirigeant", ["repas du dirigeant", "repas ilias", "restauration pro", "dejeuner", "frais de nourriture et boissons", "food and drink"]],
    ["Assurances", ["assurances", "assurance", "axa sogarep", "sogarep"]],
    ["Frais bancaires", ["frais bancaires", "qonto"]],
    ["Paiement TVA", ["paiement tva", "tva"]],
    ["Non catégorisé", ["non categorise", "non catégorisé", "autres"]],
    ["Abonnement logiciel", ["abonnement logiciel", "icloud ia store", "apple.com bill", "cursor ai powered ide"]]
  ];
  return aliases.find(([, keys]) => keys.some((key) => text === foldHiwayText(key) || text.includes(foldHiwayText(key))))?.[0] ?? null;
}

export function categorizeHiwayExpense(tx: Pick<DashboardTx, "label" | "company" | "category" | "amount">): HiwayExpenseCategory {
  if (tx.amount >= 0) return "Non catégorisé";

  const label = labelText(tx);
  const source = sourceText(tx);
  const mapped = mapHiwayExpenseCategory(tx.category);

  if (labelStartsWithDgfipTva(tx)) return "Paiement TVA";
  if (textLooksLikePasDsn(label) || textLooksLikePasDsn(source) || mapped === "PAS DSN") return "PAS DSN";
  if (label.includes("dgfip")) return "Non catégorisé";
  if (textLooksLikeIk(source)) return "Indemnités kilométriques";
  if (source.includes("cesu") || source.includes("pluxee") || source.includes("edenred")) return "CESU";
  if (source.includes("hiway")) {
    return source.includes("compta") || source.includes("expert") || source.includes("admin")
      ? "Hiway compta"
      : "Abonnement Hiway";
  }
  if (source.includes("wemind") || source.includes("mutuelle")) return "Mutuelle";
  if (textLooksLikeRetraite(source) || mapped === "Retraite") return "Retraite";
  if (/\bsfr\b/.test(source) || /\bfreebox\b/.test(source) || (/\bfree\b/.test(source) && /(mobile|telecom|internet|fibre|forfait|telephone)/.test(source))) {
    return "Abonnement internet & mobile";
  }
  if (textLooksLikeRepasAffaires(source)) return "Repas d’affaires";
  if (textLooksLikeRepasDirigeant(source) || source.includes("note de frais") || /\bndf\b/.test(source)) return "Repas du dirigeant";
  if (source.includes("sogarep") || /\baxa\b/.test(source) || source.includes("assurance")) return "Assurances";
  if (source.includes("solo_basic") || source.includes("solo basic") || source.includes("qonto")) return "Frais bancaires";
  if (textLooksLikeSoftware(source)) return "Abonnement logiciel";
  return mapped ?? "Non catégorisé";
}
