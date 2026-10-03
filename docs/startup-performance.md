# Optimisations du lancement — 3 octobre 2026

Les règles de correspondance des catégories Hiway sont maintenant normalisées une fois au chargement du module. L’ordre des règles et les correspondances partielles sont conservés. Ce calcul partagé est utilisé par le dashboard web et le backend mobile.

## Mesures locales

- Résumé mobile : médiane de 2 206,8 ms avant, 278,7 ms après (environ 87 % de réduction du temps de calcul).
- Fixture synthétique de 3 000 transactions sur 2023–2026, date de référence 3 octobre 2026, TJM 820, calendrier et factures vides. Les transactions alternent un encaissement client pour quatre frais Qonto, dont des encaissements après le 26. Une exécution de chauffe puis trois exécutions mesurées avec `performance.now()`. Le résultat JSON complet après optimisation a été comparé au résultat avant optimisation : identique.
- JavaScript initial `/dashboard`, build Next.js : 408 → 396 kB ; code propre à la route : 186 → 174 kB. Le calendrier d’activité est chargé à la première ouverture de cet onglet.

Ces chiffres concernent le calcul local et le poids estimé par Next.js, pas une mesure du lancement complet sur iPhone ou réseau mobile.

## Autres changements

- Calendrier du résumé mobile chargé en parallèle des transactions, paramètres, tarifs et factures, après vérification de la session. Les contrôles de données incomplètes sont conservés.
- Allocations de dépenses indexées par date analytique pour éviter des scans répétés de l’historique ; suppression des copies successives des tableaux internes de détail.
- Analyse du mois courant réutilisée pour sa tendance sur le web.
- iOS affiche la navigation dès la restauration de session, sans attendre le résumé réseau. Les écrans secondaires sont créés lors de leur première ouverture, puis conservés pour préserver leur état.
- Rafraîchissements iOS simultanés évités ; préchargement Activité lancé après le résumé. La déconnexion invalide la requête en cours, permettant un nouveau chargement pour la prochaine session.

## Validation

144 tests réussis, TypeScript et build Next.js réussis, compilation Xcode simulateur réussie. Navigation web Dashboard → Activité → Dashboard vérifiée sur localhost, calendrier et indicateurs présents. Mesure sur iPhone réel et publication en production non réalisées pour cette évolution.
