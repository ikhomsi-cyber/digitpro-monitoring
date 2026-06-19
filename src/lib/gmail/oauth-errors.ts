/** Message utilisateur pour les erreurs OAuth Google renvoyées sur le callback. */
export function gmailOAuthErrorMessage(code: string | null): string {
  const key = (code ?? "").toLowerCase();
  if (key === "access_denied") {
    return (
      "Accès refusé : l’app OAuth est en mode test. Ajoutez votre adresse Gmail dans " +
      "Google Cloud → OAuth consent screen → Test users, puis reconnectez-vous avec ce même compte."
    );
  }
  if (key === "redirect_uri_mismatch") {
    return (
      "URI de redirection incorrecte : vérifiez que GOOGLE_REDIRECT_URI et la console Google " +
      "contiennent exactement http://localhost:3000/api/gmail/callback (ou votre URL de prod)."
    );
  }
  if (key === "no_refresh_token") {
    return "Google n’a pas renvoyé de jeton durable. Révoquez l’accès dans votre compte Google, puis reconnectez.";
  }
  if (key === "invalid_grant") {
    return (
      "Accès Gmail révoqué ou expiré. Reconnectez Gmail depuis l’onglet Activité. " +
      "En mode test OAuth Google, les jetons expirent au bout de 7 jours — vérifiez aussi que GOOGLE_CLIENT_ID, " +
      "GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI correspondent à l’environnement (local vs prod)."
    );
  }
  return code ?? "Erreur inconnue";
}
