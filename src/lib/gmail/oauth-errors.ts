/** Message utilisateur pour les erreurs OAuth Google renvoyées sur le callback. */
export function gmailOAuthErrorMessage(code: string | null): string {
  const key = (code ?? "").toLowerCase();
  if (key === "connection_failed") return "La connexion Gmail n’a pas pu être enregistrée. Relancez-la depuis le compte choisi ; votre autre compte reste conservé.";
  if (key === "not_authenticated") return "Reconnectez-vous à DigitPro, puis relancez la connexion Gmail.";
  if (key === "account_already_connected") return "Cette adresse Gmail est déjà connectée dans l’autre emplacement. Choisissez-la dans le sélecteur de compte.";
  if (key === "account_slot_occupied") return "Cet emplacement contient déjà un autre compte Gmail. Le compte existant a été conservé ; choisissez l’emplacement libre.";
  if (key === "invalid_state") {
    return "La tentative de connexion Gmail a expiré ou n’est pas valide. Relancez la connexion depuis le tableau de bord.";
  }
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
