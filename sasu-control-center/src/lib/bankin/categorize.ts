/**
 * Catégorisation « style Bankin » : colonnes export Catégorie + Sous-catégorie,
 * avec repli sur le libellé lorsque Bankin laisse « A catégoriser » ou champs vides.
 *
 * Le libellé stocké en base reprend la hiérarchie Bankin : `Parent › Sous-catégorie`
 * (sans le point final typique des parents dans l’export).
 */

export type BankinCategorizeInput = {
  parentCategory: string;
  subCategory: string;
  description: string;
  amount: number;
};

function fold(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Affiche la paire Bankin comme dans l’UI historique (parent + sous-catégorie). */
export function formatBankinHierarchy(parentRaw: string, subRaw: string): string {
  const parent = parentRaw.trim().replace(/\.\s*$/, "").trim();
  const sub = subRaw.trim();
  if (!parent && !sub) return "Non classé";
  if (!sub || sub === parentRaw.trim()) return parent || sub;
  return `${parent} › ${sub}`;
}

/**
 * Libellé de regroupement « sous-catégorie » à partir de la catégorie stockée (`Parent › Sous-catégorie`).
 * Si pas de séparateur (ex. catégorie mappée court « Frais de personnel »), retourne la chaîne entière.
 */
export function bankinSubcategoryLabel(storedCategory: string | null | undefined): string {
  const raw = String(storedCategory ?? "").trim();
  if (!raw) return "Sans sous-catégorie";
  const m = /\s[›>]\s/u.exec(raw);
  if (m?.index != null) {
    return raw.slice(m.index + m[0].length).trim() || raw;
  }
  return raw;
}

type Rule = { re: RegExp; category: string };

/**
 * Règles sur le libellé / contrepartie quand Bankin n’a pas classé l’opération.
 * Ordre : du plus spécifique au plus générique.
 */
const DESCRIPTION_INFERENCE: Rule[] = [
  { re: /\b(sncf|ouigo|tgv|ter\b|idfm|navigo|ratp|keolis|flixbus)\b/i, category: "Auto & Transports › Transports en commun (inféré)" },
  { re: /\b(uber|bolt|heetch|kapten|allocab)\b/i, category: "Auto & Transports › Taxi & VTC (inféré)" },
  { re: /\b(total|shell|esso|bp\b|avia|leclerc energie|carrefour market essence)\b/i, category: "Auto & Transports › Carburant (inféré)" },
  { re: /\b(vinci|sanef|sapn|area|asfa|aprr|péage|peage)\b/i, category: "Auto & Transports › Péage (inféré)" },
  { re: /\b(pharmacie|pharma|parapharmacie|monoprix\s*sante)\b/i, category: "Santé › Pharmacie (inféré)" },
  { re: /\b(doctolib|dentiste|cabinet medical)\b/i, category: "Santé › Médecin (inféré)" },
  { re: /\b(amazon|fnac|darty|boulanger|ldlc|materiel\.net)\b/i, category: "Achats & Shopping › High Tech (inféré)" },
  { re: /\b(carrefour|auchan|leclerc|intermarche|lidl|aldi|monoprix|casino|super u)\b/i, category: "Alimentation & Restau. › Supermarché / Epicerie (inféré)" },
  { re: /\b(mcdo|mcdonalds|quick|kfc|subway|burger king|five guys)\b/i, category: "Alimentation & Restau. › Fast foods (inféré)" },
  { re: /\b(starbucks|pret a manger|paul\b|brioche doree)\b/i, category: "Alimentation & Restau. › Café (inféré)" },
  { re: /\b(netflix|spotify|disney|prime video|canal\+|ocs)\b/i, category: "Abonnements › Loisirs numériques (inféré)" },
  { re: /\b(orange|sfr|free mobile|bouygues|red by sfr)\b/i, category: "Abonnements › Téléphonie mobile (inféré)" },
  { re: /\b(edf|engie|direct energie|ekwateur|enedis)\b/i, category: "Logement › Electricité (inféré)" },
  { re: /\b(loyer|bail|agence immo)\b/i, category: "Logement › Loyer (inféré)" },
  { re: /\b(impot|impôt|dgfip|tresor public|cfe\b|taxe fonciere|foncière)\b/i, category: "Impôts & Taxes › Impôts & Taxes - Autres (inféré)" },
  { re: /\b(paypal|virement|vir\.|transferwise|wise\.)\b/i, category: "Retraits, Chq. et Vir. › Virements internes (inféré)" },
  { re: /\b(retrait dab|retrait gab| distributeur)\b/i, category: "Retraits, Chq. et Vir. › Retraits d’espèces (inféré)" }
];

function inferCategoryFromDescription(description: string): string | null {
  const blob = fold(description);
  if (!blob) return null;
  for (const { re, category } of DESCRIPTION_INFERENCE) {
    if (re.test(blob)) return category;
  }
  return null;
}

/** Sous-catégories métier : alignement avec les libellés produit / `mapExpenseCategoryLabel`. */
function mapDigitProBankinSubToAppCategory(sub: string): string | null {
  const s = fold(sub);
  if (s.includes("digitpro consulting bnc")) return "Frais de personnel";
  if (s.includes("digitpro consulting ndf")) return "NDF DigitPro";
  if (s.includes("digitpro consulting ik")) return "Indemnités kilométriques";
  return null;
}

/**
 * Catégorie affichée / stockée pour une ligne d’export Bankin.
 * Ne modifie pas le montant ; tient compte du signe uniquement pour d’éventuelles extensions.
 */
export function categorizeBankinTransaction(input: BankinCategorizeInput): string {
  const parent = input.parentCategory.trim();
  const sub = input.subCategory.trim();
  const desc = input.description.trim();

  const digitPro = mapDigitProBankinSubToAppCategory(sub);
  if (digitPro) return digitPro;

  const pFold = fold(parent);
  const sFold = fold(sub);
  const isUncategorized =
    (pFold === "divers" && sFold === "a categoriser") ||
    (pFold === "divers" && sFold.includes("categoriser")) ||
    (!parent && !sub);

  if (isUncategorized) {
    const inferred = inferCategoryFromDescription(desc);
    if (inferred) return inferred;
    if (parent || sub) return formatBankinHierarchy(parent, sub);
    return "Divers › A catégoriser";
  }

  return formatBankinHierarchy(parent, sub);
}
