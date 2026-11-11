# Rapprochement des révisions Bankin dans Pilote

Les imports Excel et Gmail passent par `saveBankinPiloteSnapshot` et le même rapprochement.

1. Réserver d'abord les correspondances d'identité exacte, en conservant le nombre d'occurrences. Deux paiements présents ensemble dans l'export restent distincts.
2. Pour une nouvelle identité, rechercher uniquement les anciennes opérations absentes de cet export. Exiger le même compte, le même montant signé au centime et au maximum trois jours de décalage.
3. Exiger un libellé normalisé identique ou enrichi avec les mêmes mots significatifs. Un virement générique ne peut être rapproché que le même jour avec les mêmes catégories d'origine.
4. La correspondance doit être unique dans les deux sens. En cas d'ambiguïté, suspendre l'import sans enregistrer de nouvelles lignes.
5. Conserver les identités précédentes avec l'opération rapprochée : réimporter un ancien fichier ne recrée pas la version provisoire. Garder les exclusions manuelles et l'historique absent de l'export.

Les nouveaux exports conservent le compte dans le détail Pilote. Pour les anciennes lignes, le compte est vérifié en reconstruisant leur empreinte SHA-256 originale. Sans cette preuve, aucun rapprochement approximatif n'est effectué.

Cette règle agit lors de la fusion des exports. Elle ne supprime pas automatiquement les doublons déjà accumulés et ne modifie pas la synchronisation des transactions générales. Les exceptions historiques de reporting restent indépendantes.
