# DigitPro iOS

App native SwiftUI pour iPhone/iPad (iOS 17+), partageant Supabase et les calculs métier avec DigitPro web. Projet : **DigitPro iOS.xcodeproj**, scheme **DigitPro**. Extension incluse : **DigitProWidget**.

L’analyse et les limites se trouvent dans [l’architecture](../docs/digitpro-ios-architecture.md).

## Validation et déploiement

Préférence utilisateur (22 septembre 2026) : préparer les changements, exécuter les tests et compiler iOS localement, puis demander son accord explicite avant tout déploiement en production. Ne pas déployer automatiquement à chaque évolution. Les tests visuels sur simulateur et iPhone sont réalisés par l’utilisateur.

## Lancer

1. Installer Xcode et ses composants iOS. Xcode 27.0 (27A266a) est maintenant installé sur ce Mac.
2. Déployer les nouvelles routes `/api/mobile/v1/overview` et `/api/mobile/v1/transactions` dans un environnement de recette utilisant le même projet Supabase que le compte à tester.
3. Depuis la racine du dépôt, configurer les valeurs publiques sans afficher les clés :

   ```sh
   python3 ios/configure-local.py --api-url https://votre-domaine-de-recette
   ```

   Le script lit uniquement `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans `.env.local`. Le fichier `DigitPro/Config/Local.xcconfig` est ignoré par Git. Les URL sont échappées pour xcconfig. Sur ce Mac, ce fichier pointe maintenant sur l’origine réelle de production : `https://digitpro-monitoring.vercel.app`. L’ancienne adresse `digitpro-monitoring-md1k.vercel.app` issue de `.env.example` ne doit plus être utilisée.
4. Ouvrir `ios/DigitPro iOS.xcodeproj`. Autoriser la résolution Swift Package Manager (Supabase Swift **2.48.0**, version épinglée).
5. Sélectionner l’équipe Apple de signature pour les deux cibles. Adapter les deux bundle IDs si nécessaire, puis enregistrer le même App Group pour l’app et l’extension. `DIGITPRO_APP_GROUP` peut être défini dans `Local.xcconfig` (valeur initiale `group.fr.digitpro.ios`).
6. Choisir un simulateur ou un iPhone, lancer le scheme DigitPro, se connecter avec un compte existant. Connexion e-mail/mot de passe implémentée ; passkeys/OAuth et récupération de mot de passe restent sur le web.

Compilation simulateur (sur un Mac avec Xcode) :

```sh
xcodebuild -project 'ios/DigitPro iOS.xcodeproj' -scheme DigitPro \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Le générateur `python3 ios/generate-project.py` régénère le projet et ses plist sans installer XcodeGen. Il écrase les changements manuels dans ces fichiers ; adapter le générateur pour les conserver. Il ne modifie pas `Local.xcconfig`.

## Fonctionnalités présentes

- Dashboard, CA HT/TTC, dépenses, solde importé, historique mensuel, actualisation manuelle.
- Activité native : calendrier mensuel facturé/vacances/voiture, kilomètres supplémentaires, TJM, objectif annuel, historique et projection de rythme.
- Transactions en consultation, recherche, filtres professionnel/personnel, pagination, détail.
- Projection annuelle, confiance, réel/prévisionnel, versements IK/NDF/BNC.
- LMNP et historique mensuel, NDF validées du mois, provisions CSG/TVA.
- Face ID avec repli sur le code iPhone, masquage du sélecteur d’apps, verrouillage au retour d’arrière-plan.
- Rappel local le lundi à 9 h, activation volontaire et désactivation dans Réglages.
- Widget mensuel petit/moyen : entrées TTC/HT, jours travaillés, CA sécurisé, dépenses DigitPro et personnelles. Activation volontaire, données expirées après 24 h, désactivation avec le verrouillage et purge à la déconnexion.

## Recette nécessaire avant distribution

- Deux comptes distincts : vérifier que chaque utilisateur ne voit que ses transactions et qu’un JWT expiré est refusé.
- Connexion, redémarrage, renouvellement de session, mode avion, reconnexion, déconnexion sans déconnecter le web.
- Dashboard avec plus de 1 000 transactions, historique vide, solde absent, calendrier manquant et service indisponible.
- Comparer Dashboard, LMNP, NDF et prévisionnel aux mêmes dates/données sur le web ; tenir compte du solde importé versus Qonto live.
- Recherche rapide, pagination, filtres et actualisation pendant une requête ; aucune réapparition de résultats obsolètes.
- Face ID : succès, annulation, échec, repli code, arrière-plan ; aucun montant dans le sélecteur d’apps.
- Notifications : autorisation, refus, activation/désactivation et nettoyage à la déconnexion. Ce ne sont pas des push APNs.
- Widget : App Group, activation, expiration, verrouillage, déconnexion, changement de compte ; aucun solde de l’ancien utilisateur.
- VoiceOver, Dynamic Type, mode sombre, petits iPhone et iPad.

La compilation native app + widget pour simulateur (arm64 et x86_64) a réussi sous Xcode 27.0 le 21 septembre 2026. La recette fonctionnelle authentifiée reste à effectuer. Le backend mobile est destiné au projet Vercel existant ; aucune migration Supabase ni publication App Store n’est nécessaire pour le tester dans Xcode.

Références : [Supabase Swift](https://github.com/supabase/supabase-swift/tree/v2.48.0), [connexion Supabase](https://supabase.com/docs/reference/swift/auth-signinwithpassword), [WidgetKit](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension).

## Vérifications effectuées

- `npm run test` : 27 fichiers, 80 tests réussis (dont les contrôles Activité et de son API authentifiée).
- `npm run typecheck` : réussi.
- `npm run build` : réussi, routes mobiles incluses.
- `plutil -lint` : projet Xcode, Info.plist et entitlements valides.
- `swiftc -frontend -parse -parse-stdlib` : syntaxe des sources app/widget valide. Cette commande ne vérifie ni les types SwiftUI ni les dépendances ; la compilation Xcode a depuis réussi pour les deux cibles.
- `Local.xcconfig` confirmé ignoré par Git.

Avant un futur déploiement Vercel, mettre à jour la CLI installée (59.1.4) avec `npm i -g vercel@latest` pour la compatibilité. Aucune mise à jour globale n’a été effectuée ici.

- Validation Xcode du 21 septembre 2026 : `BUILD SUCCEEDED`, aucune alerte de compilation, dépendances Swift résolues et épinglées dans `Package.resolved`. Configuration publique HTTPS vérifiée dans le bundle compilé, sans afficher les clés.

## Refonte de l’interface — 21 septembre 2026

Identité émeraude/bleu pétrole reprise du web, typographie SF arrondie, cartes translucides, Dashboard avec solde central et graphique sélectionnable, filtres d’opérations et regroupement par date, écrans Prévisionnel/LMNP/NDF/Fiscalité harmonisés, thème sombre/clair/système. Les pannes de chargement s’affichent dans la page avec action de reprise. Aucun montant de démonstration ne masque une panne.

Pour les prochains tests utilisateur : ouvrir le projet, sélectionner le scheme DigitPro et lancer **⌘R** afin d’installer le nouveau build. Revenir sur l’onglet Accueil et actualiser. Les essais interactifs dans le simulateur sont laissés à l’utilisateur ; l’agent vérifie la compilation et les API.

## Déploiement validé — 21 septembre 2026

- URL de production : https://digitpro-monitoring.vercel.app
- Déploiement : `dpl_DD8143M8zgJvkydryVuyqvep4L9E`, promu après vérification.
- CLI utilisée : Vercel 59.23.2 via npx, sans modification globale.
- `/api/mobile/v1/health` : 200, version 1, ready true.
- `/api/mobile/v1/overview` et `/transactions` : 401 sans session ; jeton invalide refusé.
- `/login` : 200 ; `/dashboard` : redirection 307 vers la connexion sans session.
- Build final Xcode app + widget : réussi, aucune alerte dans le journal final.
- Lecture financière authentifiée, rendu et interactions : à valider par l’utilisateur dans le simulateur. Aucun compte de test n’a été créé et aucun jeton utilisateur n’a été extrait.

Le précédent déploiement `dpl_jAqfZnWEacfP511v2JH3oi9gEt8C` reste disponible pour un retour arrière si nécessaire.

## Catégories de dépenses du Dashboard

Anneau sélectionnable, couleurs et règles métier identiques au web, classement des catégories avec montants, pourcentages et nombre d’opérations. Sélection d’un des douze derniers mois ou du cumul, bascule HT/TTC, variation par rapport au mois précédent et ouverture des opérations par catégorie avec pagination. BNC, TVA et dépenses personnelles exclus ; les repas restent TTC selon la règle du Dashboard web.

L’API overview expose désormais `expenses` (champ optionnel côté Swift pour compatibilité). La route authentifiée `/api/mobile/v1/expenses` fournit le détail ; aucune migration ni écriture de transaction. Tests des filtres, règles HT/TTC, catégories manuelles, totaux, pagination, authentification et refus de résultats incomplets.

Recette utilisateur : lancer ⌘R, actualiser Accueil et parcourir « Où va votre argent ? ». Comparer un mois avec le web, changer HT/TTC, toucher une catégorie puis vérifier ses opérations. Tester aussi un mois vide, le thème clair et VoiceOver.

Déploiement des catégories validé le 21 septembre 2026 : `dpl_3NmeNksv8FqbAt4cyb2gRjCEzVD9`, promu sur https://digitpro-monitoring.vercel.app après contrôle du déploiement isolé. Après promotion : health 200/ready, expenses et overview 401 sans session, login web 200. Build iOS réussi sans avertissement, build web et typecheck réussis, 76 tests réussis. Le rendu et le parcours authentifié restent à tester dans Xcode par l’utilisateur.

## Onglet Activité iOS

L’onglet reprend les fonctions métier du web : jours facturés, vacances personnelles, trajets voiture, kilomètres supplémentaires, jours ouvrés français et jours fériés, TJM par période, CA sécurisé, reste à facturer, projection mensuelle, historique des jours, performance TJM YTD, objectif annuel et projection au rythme courant. Les modifications du calendrier et des réglages sont enregistrées dans les mêmes tables Supabase avec le JWT de l’utilisateur et les politiques RLS existantes.

Recette utilisateur : lancer **⌘R**, ouvrir **Activité**, changer de mois, puis toucher une date dans chacun des modes Facturé, Voiture et Vacances. Vérifier la même date dans le web, modifier les kilomètres et l’objectif annuel, puis comparer les quatre KPI et le graphique d’historique.

Déploiement Activité validé le 21 septembre 2026 : `dpl_EsYVwKZ1ocQZzW9TeYvWBmSbu7vs`, promu sur https://digitpro-monitoring.vercel.app. Le déploiement isolé a répondu 200/ready sur health et 401 sans session sur les lectures et écritures Activité. Après promotion : health 200, Activité 401 sans session et login web 200. Les 80 tests, le typecheck, le build Next.js et la compilation Xcode ont réussi.

## Affichage des dépenses — inspiration Analyse iOS

La section « Où va votre argent ? » utilise désormais un anneau central plus généreux, une navigation mensuelle avec flèches, un sélecteur HT/TTC, une présentation Catégories/Vue compacte et des lignes de catégories proches d’une app bancaire native. La feuille de détail regroupe le total et les transactions dans une hiérarchie plus lisible. La palette est volontairement désaturée (bleu grisé, sauge, sable, mauve et corail doux) et s’adapte aux modes clair et sombre. Aucun calcul métier ni contrat API n’a été modifié.

## Widget résumé mensuel

Le widget affiche désormais les entrées du mois en TTC et HT, le nombre de jours travaillés, le CA sécurisé HT, ainsi que les montants DigitPro et personnels issus de la même répartition que le Dashboard web. Les formats petit et moyen sont pris en charge. Les données sont rafraîchies par l’overview à l’ouverture ou à l’actualisation de l’app, restent privées avec `privacySensitive`, expirent après 24 heures et sont supprimées à la déconnexion.

Déploiement widget validé le 21 septembre 2026 : `dpl_GDJTASisEm4U3LZwr8UB6SZajLRg`, promu sur https://digitpro-monitoring.vercel.app après vérification isolée. Health 200/ready, overview 401 sans session et login 200 après promotion. Compilation Xcode app + extension réussie, build Next.js et typecheck réussis, 81 tests réussis.

## Icône et optimisation Activité

L’app utilise maintenant l’icône du web (fond noir, barres blanches et accent bleu) dans un AppIcon iOS opaque de 1024 px. L’écran Activité ne recharge plus toutes les transactions lors d’un changement de mois : après le chargement initial, `/api/mobile/v1/activity/month` ne lit que les jours facturés, vacances, trajets, kilométrage, TJM et périodes nécessaires au mois demandé. Les blocs Objectif annuel et projection de rythme ont été retirés de l’écran iOS. Le graphique Jours facturés est sélectionnable et affiche le mois, le statut, les jours, le TJM HT, le montant HT et la planification éventuelle.

Déploiement validé le 21 septembre 2026 : `dpl_8W6JiC93E7T3u8Kb7e8z6vF61YSY`, promu sur https://digitpro-monitoring.vercel.app. Health 200, route mensuelle 401 sans session et login 200 après promotion. Compilation Xcode réussie sans avertissement, build Next.js et typecheck réussis, 82 tests réussis.
