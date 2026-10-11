# Activation des protections DigitPro

## État au 11 octobre 2026

Les corrections sont implémentées dans le dépôt principal. Les modifications iOS préexistantes sont conservées.

- Qonto : UUID propriétaire vérifié avant lecture/sync ; refus si absent ; aucun autre utilisateur autorisé. L'UUID du seul compte Supabase existant est configuré localement et dans Vercel production.
- Gmail/Powens : accès serveur vérifié, stockage privé préparé, chiffrement AES-256-GCM lié à l'utilisateur, l'intégration et la colonne. Aucun repli vers les tables publiques. Le navigateur ne reçoit plus le token permanent Powens.
- API : origine contrôlée sur les mutations REST par cookies, erreurs publiques réduites, diagnostics publics minimaux, réponses API sans cache et headers de sécurité.
- Imports : SheetJS 0.20.3, validation des dates/nombres/longueurs/métadonnées, maximum 10 000 lignes et 3 Mo, contrôle de la taille décompressée des archives XLSX.
- Réseau : HTTPS et destinations fournisseurs fixes, Powens limité au domaine configuré, redirections refusées, délai de requête de 20 secondes, arrêt immédiat sur 401/403. La sync Qonto a un budget de pages et de lignes.
- Synchronisations : lease PostgreSQL partagé entre instances, expiration de six minutes, intervalle minimal d'une minute. Applicable aux imports Qonto, Powens et factures Gmail web/mobile.
- Agent : une seule route de lecture d'agrégats professionnels, périodes de 93 jours maximum, 10 000 transactions maximum. Aucun outil de mutation, paiement, SQL, email ou déploiement. Credential opaque distinct du JWT humain, stocké uniquement sous forme de hash, durée d'une heure, maximum 100 appels, espacement de deux secondes, audit et révocation vérifiée avant de retourner les données.
- CI : tests applicatifs et SQL, typecheck, build et audit npm production, token GitHub en lecture seule.

Production Supabase activée le 11 octobre 2026 via le connecteur : les deux migrations sont appliquées, une connexion Powens chiffrée, zéro token Powens en clair, zéro grant agent. Les rôles navigateur ne peuvent accéder ni au schéma privé ni à la RPC de lecture des secrets. La table expense_notes, absente malgré son ancienne migration enregistrée, a été recréée avec RLS et contrôle de propriété. Le search_path de set_updated_at a été durci.

Une sauvegarde chiffrée des deux tables de connexions est conservée localement dans `.security-backups/integrations-20261011.enc` (mode 0600, AES-256-GCM, AAD `digitpro-security-backup-v1`, disposition IV 12 octets / tag 16 octets / ciphertext, clé INTEGRATION_TOKEN_ENCRYPTION_KEY). Il s'agit d'une sauvegarde ciblée des connexions, pas d'une sauvegarde complète de la base. Conserver la clé séparément pour la restauration.

Vercel production possède la service role et la clé de chiffrement sensible ; les restrictions Qonto, agents désactivés et inscriptions fermées sont configurées. Déploiement source production READY : `dpl_3mthhxijJnwZJzwjqqWjSm82RCXo`, accessible sur https://digitpro-monitoring-ikhomsi-cybers-projects.vercel.app. Build Vercel réussi avec Next.js 15.5.27 et Node.js 24. Aucun secret, sauvegarde ou fichier iOS inclus.

Supabase Auth finalisé sur le forfait Free : inscriptions publiques désactivées au fournisseur (API settings confirme disable_signup=true), connexions anonymes désactivées, confirmation email maintenue, longueur minimale de mot de passe passée à 12 et changement sécurisé du mot de passe activé. La protection HaveIBeenPwned nécessite Pro ou supérieur : aucun abonnement payant modifié. L'avertissement advisor correspondant reste donc attendu. Les trois informations RLS sans policy sur les tables privées sont intentionnelles (service role seule).

Les opérations Vercel sont disponibles dans cette session, mais l'outil de permissions du plugin ne reconnaît pas l'app liée comme installée et renvoie seulement une politique globale « Allow low-risk actions ». Cela ne prouve pas un accès Vercel en lecture seule. Aucune permission globale Codex/ChatGPT n'a été modifiée, et la restriction du connecteur de production reste à régler sur la connexion réellement utilisée.

## Ordre d'activation obligatoire

Prévoir une courte fenêtre de maintenance pour les connexions/synchronisations et une sauvegarde restaurable. Ne pas provisionner de credential agent avant la fin des contrôles.

1. Déjà effectué : dans Supabase Auth, désactiver les nouvelles inscriptions si l'application reste personnelle. `ALLOW_PUBLIC_SIGNUP=false` masque le parcours de l'app mais ne désactive pas l'API Auth du fournisseur.
2. Dans Vercel **production**, vérifier `SUPABASE_SERVICE_ROLE_KEY` et définir `INTEGRATION_TOKEN_ENCRYPTION_KEY` comme secret : 32 octets aléatoires encodés en 64 caractères hexadécimaux. Garder une sauvegarde sécurisée de cette clé hors de la base. Le script de migration doit recevoir exactement la même clé. La clé locale générée ne doit pas être copiée en preview ni publiée ; si développement et production utilisent actuellement la même base, coordonner leur clé ou séparer les projets avant l'activation.
3. Appliquer dans cet ordre les migrations `20261011081900_private_integration_secrets.sql` et `20261011081906_sync_jobs_and_agent_access.sql`. Elles déplacent les tables sans supprimer les connexions existantes et révoquent les accès navigateur.
4. Chiffrer les tokens existants depuis un environnement de confiance configuré avec l'URL, la service role et la clé de production. Le script ne les affiche pas et peut être relancé sans double chiffrement :

   ```sh
   node --env-file=/chemin/securise/.env.security-production scripts/encrypt-integration-tokens.mjs
   ```

   Le fichier d'environnement doit rester ignoré par Git, protégé par des permissions restrictives et hors de tout sandbox agent. Ne pas mettre les valeurs des secrets dans des arguments de commande ni les transmettre dans le chat.

5. Déployer le code vérifié. Une vieille version utilisant les tables publiques ne pourra plus synchroniser après l'étape 3 ; ne pas revenir à cette version sans revue de la compatibilité du stockage.
6. Vérifier les connexions Gmail/Powens existantes, le solde et la sync Qonto du propriétaire, une sync mobile et une catégorisation web. Avec un compte de test séparé, vérifier le refus Qonto et l'impossibilité de lire les secrets via REST/RPC. Garder `AGENT_ACCESS_ENABLED=false` pendant ces contrôles.

## Donner accès à un agent précis

Une fois la production vérifiée, créer un credential avec le script opérateur depuis un environnement de confiance. Exemple local avec un fichier de sortie ignoré et de mode 0600 :

```sh
mkdir -p .agent-credentials
node --env-file=.env.local scripts/agent-grant.mjs create analyste-finance .agent-credentials/analyste.token
```

Le script affiche l'ID du grant mais jamais le credential. Transmettre ce fichier uniquement au runtime de l'agent choisi. Configurer `AGENT_ACCESS_ENABLED=true` dans l'environnement concerné et redéployer pour activer la route.

L'agent appelle uniquement `GET /api/agents/v1/summary?from=2026-10-01&to=2026-10-11` avec `Authorization: Bearer <credential>`. Il reçoit les crédits, débits et le solde net des flux sur la période, pas un résultat comptable ni les libellés bancaires. Le tenant et le périmètre professionnel proviennent du serveur ; l'agent ne les choisit pas.

Révocation immédiate d'un grant :

```sh
node --env-file=.env.local scripts/agent-grant.mjs revoke ID_DU_GRANT
```

Arrêt global immédiat dans le SQL Editor administrateur :

```sql
update private.agent_grants set revoked_at=now() where revoked_at is null;
```

Définir ensuite `AGENT_ACCESS_ENABLED=false` et redéployer pour fermer durablement la route. Aucun credential n'a été créé pendant cette implémentation.

## Ce qui reste hors du premier périmètre

- Les écritures agents restent interdites. L'approbation humaine liée au hash des paramètres, les brouillons et l'exécution idempotente devront être implémentés avant d'ajouter un outil de mutation. Aucun mécanisme d'approbation fictif n'est utilisé pour justifier des écritures.
- L'isolation réseau du runtime agent, ses accès MCP/CLI, la protection de ses secrets locaux et les règles d'approbation Vercel/GitHub dépendent de la configuration de ce runtime et des comptes ; les contrôles du code ne les configurent pas automatiquement.
- La politique complète CSP pour les scripts n'est pas activée : les directives ajoutées couvrent l'encadrement, la base et les objets. Établir une politique complète avec nonces et observation des violations avant enforcement pour préserver Next.js et les intégrations.
- L'isolation en worker avec durée maximale du parsing Excel reste à ajouter si des imports non fiables sont ouverts à des utilisateurs externes. Les limites de volume et les contrôles d'archive réduisent le risque, mais ne constituent pas une limite stricte de temps CPU.
- Les sauvegardes et la restauration, les protections iOS/écran verrouillé et la séparation effective des données preview/production restent à vérifier sur les services et appareils réels.
- L'audit npm production est à zéro. L'audit complet conserve 7 alertes transitives dans la chaîne Tailwind 3 de développement/build (5 élevées, 2 modérées). Elles ne sont pas supprimées par une mise à jour compatible ; npm propose une migration Tailwind 4. Planifier cette migration avec vérification visuelle des écrans, et ne pas lancer le pipeline sur des sources/patterns non fiables sans isolation.

## Vérification réalisée

172 tests passent dans 45 fichiers, dont des tests PostgreSQL embarqués exécutant réellement les deux migrations et les rôles `anon`, `authenticated` et `service_role`. Contrôles de chiffrement, tenant forgé, refus réseau, anti-CSRF, ZIP excessif, expiration/quota/révocation agents et références croisées inclus. TypeScript et build Next.js 15.5.27 vérifiés ; audit npm production : zéro vulnérabilité signalée. Ces résultats ne remplacent pas les contrôles post-déploiement sur Supabase et Vercel.

Vérification HTTP du build sur localhost : health 200, agent désactivé 403, mutation agent 405, sync mobile sans session 401, mutation web sans Origin 403, inscription fermée 307 vers login. Headers `private, no-store` sur les API et protection d’encadrement confirmés. Le serveur temporaire de vérification a été arrêté.

Contrôles en production après activation : health Supabase 200, API agent 403 (désactivée), headers CSP/nosniff/frame DENY et API agent private/no-store confirmés. Le déchiffrement du jeton Powens a été vérifié en mémoire sans appeler la banque. Les parcours métier authentifiés (sync web/mobile, catégorisation) restent à vérifier dans une session utilisateur ; aucune synchronisation financière n’a été déclenchée pour ce contrôle. Le déploiement a utilisé les fichiers locaux via API, sans commit ni push ; conserver et versionner ces changements avant un futur déploiement Git.

Finalisation : contrôle API Auth disable_signup=true / anonymous_users=false ; contrôle mobile production sans JWT : 401. Actions GitHub checkout/setup-node épinglées à leurs SHA vérifiés. Le contrôle métier authentifié nécessite une session applicative : la session Chrome de production est actuellement sur la connexion Vercel, aucune session utilisateur n’a été fabriquée pour contourner l’authentification.

Livraison Git : corrections publiées sur codex/security-agent-production (commit initial 6adfd0b). Le connecteur GitHub refuse la création de PR (403 Resource not accessible by integration) ; publication de main via la connexion SSH existante, sans force. Les fichiers web NDF déjà présents dans la version production sont conservés dans un commit distinct pour éviter une régression ; les modifications iOS restent locales. Validation du commit de sécurité isolé : 163 tests / 44 fichiers, typecheck et build réussis.

Séparation Vercel : les 14 variables auparavant partagées preview/production sont maintenant réservées à production, y compris service role Supabase et identifiants Qonto/Powens/Google. Les previews futures ne peuvent plus accéder aux services de production ; leur configuration de test doit utiliser un projet et des credentials dédiés. Les anciennes previews déjà construites peuvent conserver leur ancien environnement : restreindre/supprimer celles-ci ou renouveler les credentials pour un retrait complet. La protection Vercel existante reste active.

Migration complémentaire expense_note_upsert_ownership : grant UPDATE avec policy USING et WITH CHECK propriétaires, incluant la propriété de la transaction. Corrige la répétition d’un upsert de tag de note de frais ; test SQL réel d’upsert idempotent et de refus de réaffectation inter-utilisateurs. Les nouvelles inscriptions sont confirmées désactivées par l’API Auth.

Les noms des deux fichiers de migrations initiaux ont été alignés sur les versions réellement enregistrées par le MCP Supabase (20261011081900 et 20261011081906), pour éviter une nouvelle exécution lors d’un futur db push. La migration complémentaire 20261011083434 a été appliquée dans la session SQL Editor authentifiée après deux erreurs de requestState du connecteur, puis inscrite dans schema_migrations dans la même transaction.
