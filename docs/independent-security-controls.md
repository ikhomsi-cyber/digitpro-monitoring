# Contrôles de sécurité indépendants de Codex

État au 22 octobre 2026 : préparation locale, sans activation distante vérifiée.

Vérification des connexions ChatGPT : GitHub possède le réglage `Allow all actions` ; Supabase et Vercel héritent de `Allow low-risk actions`. La tentative de restriction via l'outil de permissions n'a pas abouti (réponse « At least one permission update is required »). Aucun changement de permission n'est donc confirmé. Modifier ces réglages depuis l'interface des connexions avant toute utilisation administrative.

Validation locale : 291 tests passent dans 66 fichiers, typecheck et build isolé `.next-security-check` réussis. `npm audit --omit=dev` a été exécuté mais n'a pas pu joindre registry.npmjs.org (ENOTFOUND) ; aucun résultat d'audit actuel n'est disponible. Les modifications applicatives et iOS préexistantes ont été conservées. Ni push ni déploiement effectué.

## Changements préparés dans le dépôt

- CODEOWNERS attribue les migrations, le code de sécurité, la CI, les scripts et la configuration de déploiement à `@ikhomsi-cyber`.
- La CI possède uniquement `contents: read`, ne conserve plus les credentials du checkout et installe les dépendances sans scripts de cycle de vie.
- Les instructions agents exigent une validation humaine explicite des changements concrets aux garde-fous.

CODEOWNERS seul ne bloque pas une fusion. Ces fichiers restent modifiables par un agent ayant accès au dépôt. Le compte humain propriétaire ne doit pas être l'identité utilisée par l'agent pour approuver ou administrer le dépôt.

## Configuration à appliquer depuis un compte administrateur humain

### GitHub

Sur la branche de production réelle, imposer un ruleset actif : pull request obligatoire, une approbation au minimum, revue des code owners, révocation des approbations après nouveaux commits, approbation du dernier push par une autre personne, résolution des conversations et contrôle requis `verify` du workflow `Security and regression checks`. Interdire force-push et suppression. Aucun compte, application ou rôle agent dans la liste de bypass.

Utiliser une identité agent distincte, avec accès au seul dépôt nécessaire et sans administration, gestion des secrets, environnements ou protections. Si l'agent utilise actuellement le compte `ikhomsi-cyber`, la séparation n'est pas établie : connecter une identité distincte avant de considérer la revue indépendante.

Configurer les alertes de sécurité vers un destinataire humain et, si disponible, exporter l'audit vers un stockage administré séparément. L'agent ne doit pouvoir ni modifier ce destinataire ni supprimer les journaux exportés.

### Vercel

Retirer à l'identité agent la gestion des membres, tokens, variables production, protections, drains et alertes. Lui réserver la preview avec des identifiants dédiés. Vérifier que les previews n'utilisent aucune base ou clé de production.

Exiger une approbation humaine pour toute mise en production, y compris promotion, rollback et déploiement CLI/API. Une approbation GitHub Environment seule ne couvre pas les autres canaux : empêcher l'identité agent d'y déployer directement. Si le forfait ne permet pas cette séparation, retirer la connexion de production de l'agent et faire déployer par l'opérateur humain.

Ne pas créer un workflow de déploiement doté de secrets production avant que l'environnement protégé et ses approbateurs soient effectivement configurés. L'approbation doit porter sur le commit et les migrations exacts.

### Supabase

Pour l'assistance financière, utiliser uniquement l'API agent dédiée. Aucun JWT humain, service role, mot de passe PostgreSQL ou accès SQL de production dans le runtime agent.

Le connecteur d'administration Supabase de production doit être retiré du runtime agent ; une connexion en lecture seule ne convient que si ses données et métadonnées sont explicitement autorisées. Préparer les migrations dans Git, les faire relire puis appliquer par un opérateur de confiance, avec le déploiement serveur et la migration des tokens correspondants.

Exporter les événements de sécurité nécessaires dans un système indépendant, avec rétention et alertes gérées par l'humain. L'audit stocké dans la même base que l'application ne résiste pas à un administrateur de cette base.

## Validation d'activation

Depuis l'identité agent réelle, vérifier avec un changement inoffensif qu'une PR sensible ne peut être fusionnée sans revue humaine et que production, paramètres de sécurité et suppression d'audit sont interdits. Arrêter au premier 401/403 ; ne pas tenter un autre canal. Conserver des preuves sans secrets dans le système de suivi de l'opérateur.

L'activation n'est acquise qu'après vérification de ces restrictions dans chaque fournisseur. Aucun déploiement ou changement de permissions distant n'est attesté par ce document.
