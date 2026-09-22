# DigitPro iOS — architecture et état de livraison

## Application existante

Le projet actif est à la racine du dépôt : Next.js App Router 15, React 19, TypeScript, Supabase Auth/Postgres. Le répertoire imbriqué `sasu-control-center/` est exclu du TypeScript racine et n’est pas la cible de ce travail. Les pages serveur chargent les données, les composants React consomment les fonctions métier de `src/lib`. La session web utilise des cookies via `@supabase/ssr` et le middleware protège les pages.

L’iOS est ajouté dans `ios/`, avec SwiftUI, Swift Charts, LocalAuthentication, UserNotifications et WidgetKit, minimum iOS 17. Les routes `/api/mobile/v1/*` sont additives. Les composants web, calculs, middleware, schéma SQL et dépendances npm sont conservés. `tsconfig.json` exclut désormais `ios/` pour ne pas analyser les exemples TypeScript des dépendances Xcode. `.vercelignore` exclut l’app native et sa configuration locale du déploiement web. Aucun changement de base distante n’est nécessaire.

## Modèles réutilisables

Source de référence : `src/lib/supabase/types.ts`, `supabase/schema.sql` **et les migrations**, qui doivent être considérés ensemble.

| Tables | Usage et portage |
| --- | --- |
| `transactions` | Source commune, montants signés, date bancaire, catégorie et arbitrage manuel, banque, solde importé, périmètre `pro`/`personal`. Liste mobile paginée et analyses. |
| `import_sessions` | Provenance et dédoublonnage des imports ; jointure utilisée par le chargeur métier. Import conservé sur le web. |
| `user_billable_settings`, `billable_work_days`, `billable_rate_periods` | TJM et planning utilisés dans le prévisionnel natif. |
| `billable_vacation_days`, `billable_commute_days`, `billable_mileage_adjustments` | Réutilisables pour un futur éditeur natif du calendrier/IK ; non édités par cette version. |
| `expense_notes` | Tags relationnels historiques ; les NDF du Dashboard actuel passent par la catégorie manuelle `NDF DigitPro`, distincte de cette table. |
| `hiway_invoices` | Facturation Gmail persistée, réutilisable pour un futur écran de factures. |
| `monthly_metrics`, `salary_simulations` | Modèles existants ; pas la source principale des indicateurs actuels. |
| `powens_users`, `gmail_oauth_tokens` | Secrets d’intégration, strictement côté serveur, jamais exposés à iOS. |

Les politiques RLS basent l’accès sur `auth.uid() = user_id`. Le mobile s’authentifie sur le **même projet Supabase**, transmet le JWT à l’API et l’API le vérifie avec `auth.getUser(token)`. Les lectures portent ensuite ce JWT et la clé publique, jamais une clé de service. La liste ajoute un filtre utilisateur explicite. Aucune session cookie web n’est utilisée par les routes mobiles. Déconnexion iOS en scope `local` afin de préserver la session web.

## Fonctions métier conservées

| Module TypeScript | Usage iOS |
| --- | --- |
| `supabase/fetch-all-transactions.ts` | Pagination, normalisation des catégories, provenance des imports. Vérification du nombre total avant calcul pour refuser une troncature. |
| `dashboard-hero-stats.ts`, `dashboard-metrics.ts` | Dashboard, date analytique, séparation professionnel/personnel, HT/TTC. |
| `year-end-projection.ts`, `billable-client-days.ts` | Prévisionnel annuel, habitudes, rythme, jours planifiés, TJM. |
| `treasury-verser.ts` | Versements BNC, IK et NDF du mois. |
| `lmnp-analyze.ts`, `lmnp-config.ts` | Achat, loyers, charges, rentabilité du bien configuré. |
| `ndf-digitpro.ts` | NDF validées, dédoublonnage inter-imports. |
| `valeur-reelle-analyze.ts`, `recoverable-expense-vat.ts`, `tax-liability.ts` | Utilisés indirectement par les indicateurs fiscaux du Dashboard. |
| `impots/tax-engine.ts`, `impots/tax-analysis.ts` | Réutilisables, mais les avis du foyer sont actuellement codés dans `tax-notices.ts`, pas rattachés à un utilisateur Supabase. Ne pas exposer ces avis via une API multi-utilisateur sans migration préalable. |

Aucune traduction des formules fiscales en Swift : leur exécution demeure côté TypeScript. Les modèles Swift décodent un contrat v1. Les périodes utilisent actuellement la date serveur, comme le web ; la généralisation d’un fuseau Europe/Paris explicite doit être menée conjointement web/mobile pour éviter une divergence aux changements de mois.

## Contrat mobile

- `GET /api/mobile/v1/health` : disponibilité de la configuration mobile, contrat v1, sans données utilisateur.
- `GET /api/mobile/v1/overview` : Dashboard, projection, trésorerie, LMNP, NDF, version, date de calcul et source du solde.
- `GET /api/mobile/v1/transactions?page=0&scope=all&search=...` : 100 opérations maximum, tri `date DESC, id DESC`, total, prochaine page ; scope `all`, `pro` ou `personal`. Les caractères joker de recherche sont échappés.
- Réponses JSON, `Cache-Control: private, no-store`, `Vary: Authorization`. Erreurs 400 (paramètres), 401 (session), 503 (service/données incomplètes).
- Les écrans gardent la dernière vue en mémoire en cas d’erreur, avec date de chargement visible et erreur explicite. Aucune donnée de démonstration ne remplace une panne.
- Pas de cache financier disque dans l’app. Le widget opt-in conserve uniquement solde/date dans un App Group, jamais les tokens ou transactions. Expiration 24 h, purge à la déconnexion et à l’activation du verrouillage, confidentialité WidgetKit.

### Écart Qonto explicite

Le solde Qonto live du web provient d’identifiants globaux serveur (`qonto/live-balance.ts`), sans relation utilisateur dans ce chargeur. L’API mobile ne le republie pas à tout utilisateur authentifié : elle utilise le dernier solde importé sous RLS et l’interface le précise. Pour la parité live, rattacher le compte Qonto à l’utilisateur côté serveur avant exposition.

### Limites existantes conservées

Le bien LMNP, plusieurs hypothèses et corrections fiscales sont configurés dans le code. Cette version réutilise ces règles, elle ne les valide pas juridiquement et ne transforme pas DigitPro en produit fiscal multi-foyers. Les analyses « impôts du foyer », l’éditeur de planning, les mutations de transactions/NDF, les factures et les imports ne sont pas encore portés en natif.

## État

Implémenté : projet Xcode app + extension, authentification e-mail/mot de passe Supabase, Dashboard, consultation/recherche de transactions, synthèse prévisionnelle/trésorerie, LMNP/NDF/provisions fiscales, verrouillage Face ID ou code, rappel **local** hebdomadaire, widget opt-in.

Mise à jour du 21 septembre 2026 : Xcode 27.0 installé, dépendances Swift Package Manager résolues, compilation app + widget réussie pour simulateur arm64 et x86_64, sans avertissement. La configuration publique HTTPS a été vérifiée dans le bundle. Restent non validés : session réelle, Face ID, notifications et widget en fonctionnement. Le backend est construit et testé séparément.

Les routes additives ont été déployées et promues en production le 21 septembre 2026 (`dpl_DD8143M8zgJvkydryVuyqvep4L9E`). À terminer pour la validation complète : vérifier les comptes réels et RLS, exécuter la recette utilisateur dans le simulateur décrite dans `ios/README.md`. Pour un iPhone physique, configurer la signature et l’App Group dans le compte Apple. Les notifications push APNs (événements serveur), la distribution TestFlight et l’icône App Store ne sont pas configurées.

## Refonte native et raccordement production

Le 21 septembre 2026, le design natif reprend la palette émeraude/bleu pétrole et la hiérarchie visuelle du web. L’erreur générique serveur provenait d’une ancienne origine Vercel et des routes mobiles non publiées. La configuration locale vise désormais `https://digitpro-monitoring.vercel.app`. Les quatre tables/relations utilisées par le mobile ont été vérifiées en lecture seule, sans demander de lignes. Le réglage Debug `ONLY_ACTIVE_ARCH=YES` aligne l’app, son widget et les packages Swift sur l’architecture du simulateur sélectionné.

Vérifications après promotion : readiness mobile HTTP 200 ; endpoints financiers HTTP 401 sans session et avec jeton invalide ; login web HTTP 200 ; Dashboard anonyme HTTP 307. Tests : 68 réussis, TypeScript et build Next.js valides. Build final Xcode app/widget réussi sans avertissement. La lecture authentifiée et la recette visuelle sont laissées à l’utilisateur conformément à sa demande.
