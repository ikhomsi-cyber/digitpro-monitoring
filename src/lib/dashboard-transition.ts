export const DASHBOARD_READY_EVENT = "digitpro:dashboard-ready";
export const DASHBOARD_TRANSITION_START_EVENT = "digitpro:dashboard-transition-start";
export const DASHBOARD_READY_DATASET = "digitproDashboardReady";
export const DASHBOARD_TRANSITION_DATASET = "digitproDashboardTransition";

/**
 * Verrouille l'interface avant même que Next ne commence à remplacer la page.
 * Cette écriture synchrone évite un frame où le dashboard peut être visible
 * entre la page de connexion et le montage du splash React.
 */
export function beginDashboardTransition() {
  if (typeof window === "undefined") return;

  delete document.documentElement.dataset[DASHBOARD_READY_DATASET];
  document.documentElement.dataset[DASHBOARD_TRANSITION_DATASET] = "loading";
  window.dispatchEvent(new Event(DASHBOARD_TRANSITION_START_EVENT));
}
