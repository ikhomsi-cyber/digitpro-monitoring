/** Message affiché quand le refresh_token Google n'est plus valide. */
export const GMAIL_RECONNECT_REQUIRED_MESSAGE =
  "Connexion Gmail expirée ou révoquée. Cliquez sur « Connecter Gmail » pour autoriser à nouveau l'accès (Google peut révoquer les jetons après 7 jours en mode test OAuth).";

/** Détecte l'erreur OAuth `invalid_grant` (jeton révoqué, expiré ou credentials incohérents). */
export function isInvalidGrantError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return /invalid_grant/i.test(error);

  const err = error as {
    message?: string;
    code?: string | number;
    response?: { data?: { error?: string; error_description?: string } };
  };

  if (err.response?.data?.error === "invalid_grant") return true;
  if (String(err.code ?? "") === "401" && /invalid_grant/i.test(err.message ?? "")) return true;

  const blob = [
    err.message,
    err.response?.data?.error,
    err.response?.data?.error_description
  ]
    .filter(Boolean)
    .join(" ");

  return /invalid_grant/i.test(blob);
}
