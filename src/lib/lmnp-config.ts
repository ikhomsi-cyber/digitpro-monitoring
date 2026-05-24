/**
 * Paramètres LMNP — bien d’Argenteuil.
 * - **Loyers** : sous-catégorie Bankin « Loyers Reçus » / « Loyers Recus ».
 * - **Achat (prix + mouvements)** : sous-catégorie « Appart Argenteuil » — somme des débits = `purchasePriceEur` (voir `bankinSubcategoryLabel`).
 * - **Autres dépenses** : charges typiques sur libellé + indices Argenteuil / LMNP ; tout **débit** « Appart Argenteuil » est traité comme **achat** (pas comme dépense LMNP).
 */

export type LmnpTransactionScopeFilter = "personal" | "all";

/** Marqueurs (normalisés) pour la sous-catégorie des **encaissements loyer**. */
export const LMNP_LOYERS_RECUS_MARKERS = [
  "loyers recus",
  "loyers recu",
  "loyer recu",
  "loyers reçus",
  "loyer reçu"
] as const;

/**
 * Marqueurs normalisés (sans accents) pour la sous-catégorie **Appart Argenteuil**
 * (débits = prix d’achat agrégé et lignes « achat » dans l’analyse LMNP).
 */
export const LMNP_APPART_ARGENTEUIL_MARKERS = ["appart argenteuil", "appart argneteuil"] as const;

export const LMNP_PROPERTY = {
  /** Date d’achat (acte) — utilisée pour filtrer « depuis l’achat ». */
  purchaseDateIso: "2023-01-15",
  /** Ville / CP : encore utiles pour les **dépenses** LMNP hors sous-catégorie Appart. */
  cityLabel: "Argenteuil",
  postalCode: "95100",
  /** Limiter l’analyse aux transactions « Privé » (recommandé Bankin). */
  transactionScope: "personal" as LmnpTransactionScopeFilter
} as const;

/**
 * Loyers reçus : jour civil **strictement après** ce seuil → rattachés au **mois civil suivant**
 * dans les agrégats LMNP (graphiques, ventilation mensuelle), comme le CA sur le dashboard.
 */
export const LMNP_LOYER_ANALYTIC_MONTH_AFTER_DAY = 26;

/** Débits liés au LMNP (hors achat immobilier, classé à part). */
export const LMNP_EXPENSE_KEYWORD_GROUPS = [
  "taxe fonciere",
  "foncier",
  "syndic",
  "copropriete",
  "copro",
  "charges copro",
  "pno",
  "multirisque",
  "assurance proprietaire",
  "garantie loyer",
  "gli",
  "agence",
  "gestion locative",
  "honoraires gestion",
  "travaux",
  "artisan",
  "cfe",
  "comptable",
  "expert comptable",
  "courtier",
  "assurance emprunteur",
  "decennale"
] as const;
