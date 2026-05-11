/**
 * Thème sombre (classe `dark` sur `<html>`).
 *
 * - Persistance : `localStorage` clé {@link DARK_MODE_LOCAL_STORAGE_KEY} (`"1"` = actif).
 * - Flag produit : `NEXT_PUBLIC_ENABLE_DARK_MODE=false` masque le bouton (déploiement sans bascule).
 */
export const DARK_MODE_LOCAL_STORAGE_KEY = "sasu-dark-mode";

export function isDarkModeUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DARK_MODE !== "false";
}
