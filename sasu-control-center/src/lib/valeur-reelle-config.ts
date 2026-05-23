import type { DerivedExpenseBucket } from "@/lib/derived-expense-bucket";

/** Groupe métier (modèle DigitPro). */
export type ValeurReelleGroup =
  | "real_expense"
  | "hidden_value"
  | "passive_income"
  | "active_income"
  | "mixed";

/** Alias UI / rétrocompat — mappe 1:1 vers {@link ValeurReelleGroup}. */
export type ValeurReelleKind =
  | "depense-reelle"
  | "depense-cachee"
  | "depense-ambigue"
  | "revenu-actif"
  | "revenu-passif";

export const KIND_BY_GROUP: Record<ValeurReelleGroup, ValeurReelleKind> = {
  real_expense: "depense-reelle",
  hidden_value: "depense-cachee",
  mixed: "depense-ambigue",
  active_income: "revenu-actif",
  passive_income: "revenu-passif"
};

export const GROUP_BY_KIND: Record<ValeurReelleKind, ValeurReelleGroup> = {
  "depense-reelle": "real_expense",
  "depense-cachee": "hidden_value",
  "depense-ambigue": "mixed",
  "revenu-actif": "active_income",
  "revenu-passif": "passive_income"
};

export type ValeurReelleTone = "red" | "green" | "orange" | "blue" | "violet";

export type ValeurReelleGroupMeta = {
  group: ValeurReelleGroup;
  kind: ValeurReelleKind;
  label: string;
  shortLabel: string;
  filterLabel: string;
  tone: ValeurReelleTone;
  color: "red" | "green" | "orange" | "blue" | "purple";
  emoji: string;
  score: number;
  description: string;
  defaultTooltip: string;
};

export const VALEUR_REELLE_GROUP_META: Record<ValeurReelleGroup, ValeurReelleGroupMeta> = {
  real_expense: {
    group: "real_expense",
    kind: "depense-reelle",
    label: "Charges entreprise",
    shortLabel: "Entreprise",
    filterLabel: "Entreprise",
    tone: "red",
    color: "red",
    emoji: "🏢",
    score: -100,
    description: "Charges structurelles de l'entreprise (Hiway, télécom, assurances…).",
    defaultTooltip:
      "Charge réellement consommée — peu ou pas de valeur personnelle récupérable."
  },
  hidden_value: {
    group: "hidden_value",
    kind: "depense-cachee",
    label: "Avantages & flux à ton bénéfice",
    shortLabel: "Avantages",
    filterLabel: "Avantages",
    tone: "green",
    color: "green",
    emoji: "💼",
    score: 50,
    description:
      "IK, repas, CESU, télécom, logiciels, énergie… une partie revient à titre personnel ou indirect.",
    defaultTooltip:
      "Cette dépense couvre aussi un besoin personnel ou crée une valeur indirecte."
  },
  passive_income: {
    group: "passive_income",
    kind: "revenu-passif",
    label: "Revenu passif",
    shortLabel: "Passif",
    filterLabel: "Passif",
    tone: "blue",
    color: "blue",
    emoji: "🔵",
    score: 100,
    description: "Loyers, dividendes, intérêts…",
    defaultTooltip: "Flux patrimonial ou récurrent hors activité directe."
  },
  active_income: {
    group: "active_income",
    kind: "revenu-actif",
    label: "CA / actif",
    shortLabel: "CA",
    filterLabel: "CA",
    tone: "violet",
    color: "purple",
    emoji: "🟣",
    score: 100,
    description: "Facturation et activité professionnelle.",
    defaultTooltip: "Chiffre d'affaires et prestations facturées."
  },
  mixed: {
    group: "mixed",
    kind: "depense-ambigue",
    label: "Dépense ambiguë",
    shortLabel: "Ambigu",
    filterLabel: "Ambigu",
    tone: "orange",
    color: "orange",
    emoji: "🟠",
    score: 25,
    description: "Usage mixte pro / perso.",
    defaultTooltip: "Une partie de cette dépense pourrait être récupérée."
  }
};

/** @deprecated Utiliser VALEUR_REELLE_GROUP_META via GROUP_BY_KIND */
export const VALEUR_REELLE_KIND_META: Record<
  ValeurReelleKind,
  {
    label: string;
    shortLabel: string;
    tone: ValeurReelleTone;
    emoji: string;
    description: string;
  }
> = Object.fromEntries(
  Object.values(VALEUR_REELLE_GROUP_META).map((m) => [
    m.kind,
    {
      label: m.label,
      shortLabel: m.shortLabel,
      tone: m.tone,
      emoji: m.emoji,
      description: m.description
    }
  ])
) as Record<
  ValeurReelleKind,
  {
    label: string;
    shortLabel: string;
    tone: ValeurReelleTone;
    emoji: string;
    description: string;
  }
>;

export function groupMetaForKind(kind: ValeurReelleKind): ValeurReelleGroupMeta {
  return VALEUR_REELLE_GROUP_META[GROUP_BY_KIND[kind]];
}

/** Postes charges entreprise (grille DigitPro — groupe 1). */
export const REAL_EXPENSE_CATEGORIES = [
  "Abonnement Hiway",
  "Hiway compta",
  "Retraite",
  "Frais bancaires",
  "Assurances",
  "Prévoyance collective",
  "Fournitures",
  "Mobilier",
  "CSG",
  "IR",
  "URSSAF",
  "TVA",
  "Divers"
] as const;

export type RealExpenseCategory = (typeof REAL_EXPENSE_CATEGORIES)[number];

/** Pictos affichés pour chaque poste entreprise. */
export const REAL_EXPENSE_CATEGORY_META: Record<
  RealExpenseCategory,
  { emoji: string; label: string }
> = {
  "Abonnement Hiway": { emoji: "🧾", label: "Abonnement Hiway" },
  "Hiway compta": { emoji: "📊", label: "Hiway compta" },
  Retraite: { emoji: "🛡️", label: "Retraite" },
  "Frais bancaires": { emoji: "🏦", label: "Frais bancaires" },
  Assurances: { emoji: "🔒", label: "Assurances" },
  "Prévoyance collective": { emoji: "🩺", label: "Prévoyance collective" },
  Fournitures: { emoji: "✏️", label: "Fournitures" },
  Mobilier: { emoji: "🪑", label: "Mobilier" },
  CSG: { emoji: "📋", label: "CSG" },
  IR: { emoji: "📋", label: "IR" },
  URSSAF: { emoji: "📋", label: "URSSAF" },
  TVA: { emoji: "📋", label: "TVA" },
  Divers: { emoji: "📦", label: "Divers" }
};

export function formatRealExpenseSublabel(category: RealExpenseCategory): string {
  const meta = REAL_EXPENSE_CATEGORY_META[category];
  return `${meta.emoji} ${meta.label}`;
}

/** Postes avantages & flux à ton bénéfice (grille DigitPro — groupe 2). */
export const HIDDEN_VALUE_CATEGORIES = [
  "Indemnités kilométriques (IK)",
  "Repas d'affaires",
  "CESU",
  "Cadeaux clientèle",
  "Repas du dirigeant",
  "Mutuelle",
  "Chèques vacances ANCV",
  "Internet & mobile",
  "Matériel informatique",
  "Achat logiciels",
  "Énergie"
] as const;

export type HiddenValueCategory = (typeof HIDDEN_VALUE_CATEGORIES)[number];

export const HIDDEN_VALUE_CATEGORY_META: Record<
  HiddenValueCategory,
  { emoji: string; label: string }
> = {
  "Indemnités kilométriques (IK)": { emoji: "🚗", label: "Indemnités kilométriques (IK)" },
  "Repas d'affaires": { emoji: "🍽️", label: "Repas d'affaires" },
  CESU: { emoji: "👶", label: "CESU" },
  "Cadeaux clientèle": { emoji: "🎁", label: "Cadeaux clientèle" },
  "Repas du dirigeant": { emoji: "🍴", label: "Repas du dirigeant" },
  Mutuelle: { emoji: "🛡️", label: "Mutuelle" },
  "Chèques vacances ANCV": { emoji: "🏖️", label: "Chèques vacances ANCV" },
  "Internet & mobile": { emoji: "📱", label: "Internet & mobile" },
  "Matériel informatique": { emoji: "💻", label: "Matériel informatique" },
  "Achat logiciels": { emoji: "💾", label: "Achat logiciels" },
  Énergie: { emoji: "⚡", label: "Énergie" }
};

/** % récupéré (0–100) par poste groupe 2. */
export const HIDDEN_VALUE_RECOVERY_PERCENT: Record<HiddenValueCategory, number> = {
  "Indemnités kilométriques (IK)": 80,
  "Repas d'affaires": 50,
  CESU: 55,
  "Cadeaux clientèle": 40,
  "Repas du dirigeant": 48,
  Mutuelle: 100,
  "Chèques vacances ANCV": 60,
  "Internet & mobile": 35,
  "Matériel informatique": 28,
  "Achat logiciels": 32,
  Énergie: 22
};

/** @deprecated Utiliser HIDDEN_VALUE_CATEGORY_META */
export const HIDDEN_VALUE_DISPLAY_GROUPS = HIDDEN_VALUE_CATEGORIES.map((label) => ({
  label,
  emoji: HIDDEN_VALUE_CATEGORY_META[label].emoji
}));

/** Catégories revenus passifs (groupe 3). */
export const PASSIVE_INCOME_CATEGORIES = [
  "Loyer France",
  "Loyer Maroc",
  "Dividendes",
  "Intérêts"
] as const;

export type PassiveIncomeCategory = (typeof PASSIVE_INCOME_CATEGORIES)[number];

/** Catégories CA / actif (groupe 4). */
export const ACTIVE_INCOME_CATEGORIES = [
  "Factures client",
  "Virements activité",
  "TJM",
  "Revenus activité"
] as const;

export type ActiveIncomeCategory = (typeof ACTIVE_INCOME_CATEGORIES)[number];

/** Catégories ambiguës (groupe 5). */
export const MIXED_CATEGORIES = [
  "Voyages",
  "Matériel",
  "Coworking",
  "Bureau",
  "Équipements",
  "Notes de frais",
  "Leasing véhicule",
  "Mixte pro/perso"
] as const;

export type MixedCategory = (typeof MIXED_CATEGORIES)[number];

/** % récupérable affiché pour le groupe ambigu (hors score principal). */
export const MIXED_RECOVERY_PERCENT = 25;

/** Buckets SASU → dépense réelle (Hiway inclus, jamais valeur cachée). */
export const REAL_EXPENSE_BUCKETS = new Set<DerivedExpenseBucket>([
  "BNC",
  "TVA",
  "Impôt",
  "Urssaf",
  "Retraite",
  "Compta & admin.",
  "Qonto",
  "Assurance"
]);

export const HIDDEN_VALUE_BUCKETS = new Set<DerivedExpenseBucket>([
  "Indemnités kilométriques",
  "Repas dirigeant",
  "Repas d'affaire",
  "CESU",
  "Mutuelle",
  "Mobile et Internet",
  "iCloud IA Store"
]);

/** Impôts & cotisations (cascade) — BNC / retraite reste en charges entreprise. */
export const TAX_BUCKETS = new Set<DerivedExpenseBucket>(["TVA", "Impôt", "Urssaf"]);

export const IK_KEYWORDS = [" ik", " ik ", "indemnite kilomet", "indemnites kilomet", "kilometrique"] as const;

export const REPAS_AFFAIRES_KEYWORDS = [
  "repas d affaire",
  "repas d'affaire",
  "dejeuner d affaire",
  "dejeuner affaire",
  "diner d affaire",
  "diner affaire",
  "invitation client",
  "restaurant affaire"
] as const;

export const REPAS_DIRIGEANT_KEYWORDS = [
  "repas dirigeant",
  "dirigeant",
  "repas ilias",
  "ilias"
] as const;

export const CESU_KEYWORDS = ["cesu", "pluxee", "edenred", "cheque emploi", "emploi familial"] as const;

export const CADEAUX_CLIENTELE_KEYWORDS = [
  "cadeau client",
  "cadeaux client",
  "cadeau clientele",
  "cadeaux clientele",
  "cadeau d affaire",
  "cadeau entreprise"
] as const;

export const CHEQUES_VACANCES_KEYWORDS = [
  "cheque vacances",
  "chèque vacances",
  "cheques vacances",
  "ancv",
  "ticket restaurant vacances"
] as const;

export const ENERGIE_KEYWORDS = [
  "edf",
  "engie",
  "energie",
  "énergie",
  "electricite",
  "électricité",
  "gaz ",
  "totalenergies"
] as const;

export const MATERIEL_INFORMATIQUE_KEYWORDS = [
  "macbook",
  "imac",
  "iphone",
  "ipad",
  "ordinateur",
  "materiel informatique",
  "matériel informatique",
  "apple store",
  "ldlc",
  "materiel info"
] as const;

export const FOURNITURES_KEYWORDS = [
  "fourniture",
  "papeterie",
  "stylo",
  "encre",
  "bureau vallee",
  "manutan"
] as const;

export const MOBILIER_KEYWORDS = ["mobilier", "ikea", "chaise", "bureau", "table", "etagere", "étagère"] as const;

export const PREVOYANCE_KEYWORDS = [
  "prevoyance",
  "prévoyance",
  "wemind",
  "we mind",
  "mutuelle",
  "collective"
] as const;

export const ASSURANCES_KEYWORDS = ["assurance", "sogarep", "axa", "rc pro", "responsabilite civile"] as const;

export const RETRAITE_KEYWORDS = [
  "retraite",
  "agirc",
  "arrco",
  "carcdsf",
  "ircantec",
  "retraite complementaire",
  "retraite complémentaire",
  "caisse de retraite",
  "cotisation retraite",
  "versement retraite",
  "malakoff",
  "humanis",
  "ag2r",
  "frais de personnel"
] as const;

export function isRetraiteExpense(
  bucket: DerivedExpenseBucket,
  blob: string,
  subcategory: string,
  category: string
): boolean {
  if (bucket === "BNC") return true;
  const cat = foldValeurReelleText(`${category} ${subcategory} ${blob}`);
  return RETRAITE_KEYWORDS.some((kw) => cat.includes(kw) || blob.includes(kw));
}

export const CSG_KEYWORDS = [
  "csg",
  "cgss",
  "contribution sociale",
  "cotisation sociale"
] as const;

export const SOFTWARE_SAAS_KEYWORDS = [
  "saas",
  "logiciel",
  "software",
  "abonnement",
  "cursor",
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
] as const;

export const PASSIVE_INCOME_KEYWORDS = [
  "loyer",
  "loyers",
  "dividende",
  "coupon",
  "interet",
  "intérêt",
  "interets",
  "intérêts",
  "placement",
  "pea",
  "assurance vie",
  "revenu foncier",
  "loyers recus",
  "loyers reçus"
] as const;

export const MOROCCO_LOYER_KEYWORDS = ["maroc", "morocco", "casablanca", "rabat", "marrakech"] as const;

export const ACTIVE_INCOME_KEYWORDS = {
  virement: ["virement activite", "virement activité", "encaissement client", "reglement client"],
  tjm: ["tjm", "tarif journalier", "jours factur"],
  activite: ["revenu activite", "revenus activite", "prestation", "honoraires"]
} as const;

export const MIXED_KEYWORDS = {
  voyages: ["voyage", "travel", "hotel", "airbnb", "booking.com", "train", "sncf", "avion", "ryanair", "air france"],
  materiel: ["equipement", "équipement", "leasing", "lld"],
  coworking: ["cowork", "wework"],
  bureau: ["bureau", "loyer bureau", "bail commercial"],
  equipements: ["location longue"]
} as const;

export const LEASING_KEYWORDS = ["leasing", "lld", "location longue duree", "location longue durée"] as const;

export function foldValeurReelleText(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function hiddenValueRecoveryRatio(category: HiddenValueCategory): number {
  return HIDDEN_VALUE_RECOVERY_PERCENT[category] / 100;
}

export function formatHiddenValueSublabel(label: HiddenValueCategory): string {
  const meta = HIDDEN_VALUE_CATEGORY_META[label];
  return `${meta.emoji} ${meta.label}`;
}

export function resolveHiddenValueCategory(
  bucket: DerivedExpenseBucket,
  blob: string,
  subcategory: string,
  category: string
): HiddenValueCategory | null {
  const cat = foldValeurReelleText(`${category} ${subcategory}`);

  if (
    bucket === "Indemnités kilométriques" ||
    blob.includes(" ik") ||
    /\bik\b/.test(blob) ||
    IK_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Indemnités kilométriques (IK)";
  }

  if (
    bucket === "Repas d'affaire" ||
    REPAS_AFFAIRES_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Repas d'affaires";
  }

  if (
    bucket === "Repas dirigeant" ||
    REPAS_DIRIGEANT_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Repas du dirigeant";
  }

  if (bucket === "CESU" || CESU_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "CESU";
  }

  if (
    bucket === "Mutuelle" ||
    PREVOYANCE_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Mutuelle";
  }

  if (CADEAUX_CLIENTELE_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "Cadeaux clientèle";
  }

  if (CHEQUES_VACANCES_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "Chèques vacances ANCV";
  }

  if (bucket === "Mobile et Internet" || blob.includes("sfr") || blob.includes("freebox") || cat.includes("mobile")) {
    return "Internet & mobile";
  }

  if (MATERIEL_INFORMATIQUE_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "Matériel informatique";
  }

  if (
    bucket === "iCloud IA Store" ||
    blob.includes("icloud") ||
    SOFTWARE_SAAS_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Achat logiciels";
  }

  if (ENERGIE_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "Énergie";
  }

  return null;
}

/** @deprecated alias */
export const resolveHiddenValueDisplayGroup = resolveHiddenValueCategory;
export type HiddenValueDisplayGroup = HiddenValueCategory;

export function resolveRealExpenseCategory(
  bucket: DerivedExpenseBucket,
  blob: string,
  subcategory: string,
  category: string
): RealExpenseCategory {
  const cat = foldValeurReelleText(`${category} ${subcategory}`);

  if (blob.includes("hiway")) {
    if (
      cat.includes("compta") ||
      cat.includes("bilan") ||
      cat.includes("liasse") ||
      blob.includes("expert comptable") ||
      bucket === "Compta & admin."
    ) {
      return "Hiway compta";
    }
    return "Abonnement Hiway";
  }

  if (bucket === "Compta & admin.") return "Hiway compta";

  if (bucket === "TVA") return "TVA";

  if (bucket === "Impôt" || blob.includes("impot sur le revenu") || blob.includes("ir ") || /\bir\b/.test(blob)) {
    return "IR";
  }

  if (isRetraiteExpense(bucket, blob, subcategory, category)) {
    return "Retraite";
  }

  if (bucket === "Urssaf") return "URSSAF";

  if (
    bucket === "Qonto" ||
    blob.includes("qonto") ||
    blob.includes("frais bancaire") ||
    blob.includes("commission bancaire") ||
    cat.includes("frais bancaire")
  ) {
    return "Frais bancaires";
  }

  if (
    bucket === "Mutuelle" ||
    PREVOYANCE_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Prévoyance collective";
  }

  if (
    bucket === "Assurance" ||
    ASSURANCES_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))
  ) {
    return "Assurances";
  }

  if (MOBILIER_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "Mobilier";
  }

  if (FOURNITURES_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) {
    return "Fournitures";
  }

  if (CSG_KEYWORDS.some((kw) => blob.includes(kw) || cat.includes(kw))) return "CSG";

  if (cat.includes("divers") || blob.includes("divers")) return "Divers";

  return "Divers";
}

/** @deprecated */
export const resolveRealExpenseDisplayGroup = resolveRealExpenseCategory;
export type RealExpenseDisplayGroup = RealExpenseCategory;

export function resolvePassiveIncomeCategory(
  blob: string,
  subcategory: string,
  category: string
): PassiveIncomeCategory {
  const cat = foldValeurReelleText(`${category} ${subcategory} ${blob}`);

  if (MOROCCO_LOYER_KEYWORDS.some((kw) => cat.includes(kw))) return "Loyer Maroc";
  if (cat.includes("loyer")) return "Loyer France";
  if (cat.includes("dividende") || cat.includes("coupon")) return "Dividendes";
  return "Intérêts";
}

export function resolveActiveIncomeCategory(blob: string, subcategory: string): ActiveIncomeCategory {
  const cat = foldValeurReelleText(`${subcategory} ${blob}`);

  if (ACTIVE_INCOME_KEYWORDS.tjm.some((kw) => cat.includes(kw))) return "TJM";
  if (ACTIVE_INCOME_KEYWORDS.virement.some((kw) => cat.includes(kw))) return "Virements activité";
  if (ACTIVE_INCOME_KEYWORDS.activite.some((kw) => cat.includes(kw))) return "Revenus activité";
  return "Factures client";
}

export function resolveMixedCategory(blob: string, bucket: DerivedExpenseBucket): MixedCategory {
  if (blobHasMixedKeyword(blob, MIXED_KEYWORDS.voyages)) return "Voyages";
  if (blobHasMixedKeyword(blob, MIXED_KEYWORDS.coworking)) return "Coworking";
  if (blobHasMixedKeyword(blob, MIXED_KEYWORDS.bureau)) return "Bureau";
  if (blobHasMixedKeyword(blob, MIXED_KEYWORDS.materiel)) return "Matériel";
  if (blobHasMixedKeyword(blob, MIXED_KEYWORDS.equipements) || blobHasMixedKeyword(blob, LEASING_KEYWORDS)) {
    return "Leasing véhicule";
  }
  if (bucket === "NDF") return "Notes de frais";
  return bucket === "Autres" ? "Mixte pro/perso" : "Équipements";
}

function blobHasMixedKeyword(blob: string, keywords: readonly string[]): boolean {
  return keywords.some((kw) => blob.includes(foldValeurReelleText(kw)));
}

export function blobMatchesMixedExpense(blob: string): boolean {
  return Object.values(MIXED_KEYWORDS).some((keywords) => blobHasMixedKeyword(blob, keywords));
}

export type ValeurReelleClassification = {
  group: ValeurReelleGroup;
  kind: ValeurReelleKind;
  category: string;
  score: number;
  recoveredValuePercent: number;
  color: ValeurReelleGroupMeta["color"];
  tooltip: string;
};

export const PEDAGOGIC_TOOLTIPS = {
  realExpense: VALEUR_REELLE_GROUP_META.real_expense.defaultTooltip,
  hiddenValue: VALEUR_REELLE_GROUP_META.hidden_value.defaultTooltip,
  hiddenExpense: VALEUR_REELLE_GROUP_META.hidden_value.defaultTooltip,
  mixed: VALEUR_REELLE_GROUP_META.mixed.defaultTooltip,
  recovery: VALEUR_REELLE_GROUP_META.hidden_value.defaultTooltip,
  optimization:
    "Part de valeur récupérée sur (charges réelles + valeur cachée récupérée). Plus le taux est élevé, mieux vous optimisez.",
  waterfall:
    "De votre CA à la valeur réellement conservée : charges, valeur récupérée, impôts, puis solde final.",
  realValueScore:
    "(CA actif + revenus passifs + valeur cachée récupérée) − dépenses réelles définitivement consommées."
} as const;
