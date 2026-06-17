export const CATEGORISATION_REFRESH_EVENT = "digitpro:categorisation-refresh";

export type CategorisationRefreshDetail = {
  /** Origine du rafraîchissement (pull, import Powens, import Qonto, etc.). */
  source?: "pull" | "powens" | "qonto" | "manual";
  /** Nombre de nouvelles transactions signalées par l’import (si connu). */
  insertedCount?: number;
};

/** Demande un rechargement backstage des données catégorisation (sans reload page). */
export function requestCategorisationRefresh(detail?: CategorisationRefreshDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CategorisationRefreshDetail>(CATEGORISATION_REFRESH_EVENT, { detail }));
}
