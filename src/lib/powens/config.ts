/**
 * Configuration déclarative Powens : périmètres pro / perso, filtres par compte BI.
 * L’API Powens renvoie toutes les transactions de l’utilisateur ; le découpage SASU vs perso se fait côté app (scope + libellé company + ids de comptes optionnels).
 */

export type PowensImportAxis = "pro" | "personal";

/** Valeurs env considérées comme « oui » (aligné diagnostics / boutons). */
export function powensTruthyEnvFlag(v: string | undefined): boolean {
  const s = v?.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Liste d’ids de comptes Powens (`id_account` dans les transactions), séparateurs virgule / espace / point-virgule. */
export function parsePowensAccountIdAllowlist(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null;
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : null;
}

export function powensDefaultCompanyLabel(axis: PowensImportAxis): string {
  if (axis === "personal") {
    return process.env.POWENS_PERSONAL_COMPANY_LABEL?.trim() || "Powens perso";
  }
  return process.env.POWENS_COMPANY_LABEL?.trim() || "Powens";
}

/** Filtre optionnel sur `id_account` pour l’axe demandé. */
export function powensAccountFilterForAxis(axis: PowensImportAxis): number[] | null {
  const raw =
    axis === "personal"
      ? process.env.POWENS_PERSONAL_ACCOUNT_IDS?.trim()
      : process.env.POWENS_PRO_ACCOUNT_IDS?.trim();
  return parsePowensAccountIdAllowlist(raw);
}

/**
 * Affiche un second bouton « Import Powens perso » lorsque la synchro principale est en SASU
 * et qu’au moins une option perso est activée (libellé dédié ou flag).
 */
export function powensPersonalSyncUiEnabled(): boolean {
  if (powensPrimaryImportAxis() === "personal") return false;
  return (
    powensTruthyEnvFlag(process.env.POWENS_SYNC_PERSONAL) ||
    Boolean(process.env.POWENS_PERSONAL_COMPANY_LABEL?.trim())
  );
}

/**
 * Axe du bouton principal Powens (`POWENS_IMPORT_SCOPE`).
 * Défaut : **personal** (comptes perso liés à Powens). Utilisez `pro` explicitement pour la SASU.
 */
export function powensPrimaryImportAxis(): PowensImportAxis {
  const v = process.env.POWENS_IMPORT_SCOPE?.trim().toLowerCase();
  if (v === "pro") return "pro";
  return "personal";
}
