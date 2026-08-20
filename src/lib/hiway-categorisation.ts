import type { DashboardTx } from "@/lib/dashboard-metrics";

export const HIWAY_EXPENSE_CATEGORIES = [
  "Indemnités kilométriques",
  "CESU",
  "ANCV",
  "Repas d’affaires",
  "Cadeau client",
  "Abonnement Hiway",
  "Urssaf",
  "Mutuelle",
  "Hiway compta",
  "Retraite",
  "Abonnement internet & mobile",
  "Repas du dirigeant",
  "Assurances",
  "Frais bancaires",
  "Matériels et fournitures",
  "Paiement TVA",
  "Impôt",
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
    ["CESU", ["cesu", "achat cesu", "ticket cesu", "cheque domicile", "chèque domicile", "domiserve", "up cesu", "bimpli cesu"]],
    ["ANCV", ["ancv", "cheque vacances", "chèque vacances"]],
    ["Repas d’affaires", ["repas d affaires", "depenses liees au marketing", "marketing expenses"]],
    ["Cadeau client", ["cadeau client", "igraal"]],
    ["Abonnement Hiway", ["abonnement hiway"]],
    ["Urssaf", ["urssaf", "cgss", "cotisation sociale", "cotisations sociales"]],
    ["Mutuelle", ["mutuelle", "wemind", "we mind", "prevoyance", "prévoyance", "prevoyance collective", "prévoyance collective"]],
    ["Hiway compta", ["hiway compta", "depenses administratives", "administrative expenses"]],
    ["Retraite", ["retraite", "frais de personnel"]],
    ["Abonnement internet & mobile", ["abonnement internet mobile", "abonnement internet & mobile", "mobile et internet"]],
    ["Repas du dirigeant", ["repas du dirigeant", "repas dirigeant", "repas ilias", "repas ilia", "restauration pro", "dejeuner", "déjeuner", "frais de nourriture et boissons", "food and drink"]],
    ["Assurances", ["assurances", "assurance", "axa sogarep", "sogarep"]],
    ["Frais bancaires", ["frais bancaires", "qonto", "qonto solo", "solo basic", "solo_basic"]],
    ["Matériels et fournitures", ["materiels et fournitures", "matériels et fournitures", "materiel", "matériel", "fournitures"]],
    ["Paiement TVA", ["paiement tva", "tva"]],
    ["Impôt", ["impot", "impôt", "impot-pas", "impot pas", "pasdsn", "pas-dsn", "impot sur le revenu"]],
    ["Non catégorisé", ["non categorise", "non catégorisé", "autres"]],
    ["Abonnement logiciel", ["abonnement logiciel", "icloud ia store", "apple.com bill", "cursor ai powered ide"]]
  ];
  return aliases.find(([, keys]) => keys.some((key) => text === foldHiwayText(key) || text.includes(foldHiwayText(key))))?.[0] ?? null;
}

function resolveManualHiwayCategory(category: string): HiwayExpenseCategory | null {
  const mapped = mapHiwayExpenseCategory(category);
  if (mapped && mapped !== "Non catégorisé") return mapped;
  const normalized = mapHiwayExpenseCategory(
    category
      .replace(/\s[›>]\s.+$/u, "")
      .trim()
  );
  if (normalized && normalized !== "Non catégorisé") return normalized;
  return null;
}

export function categorizeHiwayExpense(
  tx: Pick<DashboardTx, "label" | "company" | "category" | "amount" | "categoryManual">
): HiwayExpenseCategory {
  if (tx.amount >= 0) return "Non catégorisé";

  if (tx.categoryManual) {
    return resolveManualHiwayCategory(tx.category) ?? "Non catégorisé";
  }

  const label = labelText(tx);
  const source = sourceText(tx);
  const mapped = mapHiwayExpenseCategory(tx.category);

  if (labelStartsWithDgfipTva(tx)) return "Paiement TVA";
  // iGraal est une règle métier explicite : elle prime sur l'ancienne catégorie
  // importée (« Repas d'affaires ») afin de conserver le classement Cadeau client.
  if (source.includes("igraal") || source.includes("cadeau client")) return "Cadeau client";
  if (mapped === "Frais bancaires") return "Frais bancaires";
  if (mapped && mapped !== "Non catégorisé") return mapped;
  if (label.includes("dgfip")) return "Impôt";
  if (source.includes("urssaf") || source.includes("cgss")) return "Urssaf";
  if (textLooksLikeIk(source)) return "Indemnités kilométriques";
  if (
    source.includes("cesu") ||
    source.includes("pluxee") ||
    source.includes("edenred") ||
    source.includes("domiserve") ||
    source.includes("cheque domicile") ||
    source.includes("chèque domicile") ||
    source.includes("bimpli")
  ) return "CESU";
  if (source.includes("hiway")) {
    return source.includes("compta") || source.includes("expert") || source.includes("admin")
      ? "Hiway compta"
      : "Abonnement Hiway";
  }
  if (source.includes("wemind") || source.includes("we mind") || source.includes("mutuelle")) return "Mutuelle";
  if (textLooksLikeRetraite(source)) return "Retraite";
  if (/\bsfr\b/.test(source) || /\bfreebox\b/.test(source) || (/\bfree\b/.test(source) && /(mobile|telecom|internet|fibre|forfait|telephone)/.test(source))) {
    return "Abonnement internet & mobile";
  }
  if (textLooksLikeRepasAffaires(source)) return "Repas d’affaires";
  if (textLooksLikeRepasDirigeant(source) || source.includes("note de frais") || /\bndf\b/.test(source)) return "Repas du dirigeant";
  if (source.includes("sogarep") || /\baxa\b/.test(source) || source.includes("assurance")) return "Assurances";
  if (source.includes("qonto") || source.includes("solo_basic") || source.includes("solo basic") || source.includes("qonto solo")) return "Frais bancaires";
  if (source.includes("materiel") || source.includes("matériel") || source.includes("fourniture")) return "Matériels et fournitures";
  if (textLooksLikeSoftware(source)) return "Abonnement logiciel";
  return mapped ?? "Non catégorisé";
}
