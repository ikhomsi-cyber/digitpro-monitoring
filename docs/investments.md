# Invest — investissements personnels

L’onglet `section=invest` appartient à la navigation Perso. L’entrée directe charge uniquement le rapport Invest, sans précharger les transactions professionnelles. Il utilise le même thème, hero et navigation que Pilote et Courses. Aucun appel bancaire, Gmail ou IA n’est déclenché.

## Sources et calculs

La route authentifiée `/api/dashboard/invest` lit uniquement le snapshot Bankin du propriétaire connecté. Elle décompresse côté serveur et renvoie les agrégats immobiliers et PER ainsi que les dates et montants des opérations PER et Charges LMNP : aucun libellé bancaire, compte, identifiant d’opération ou ligne brute. Réponse privée sans cache partagé. Aucune nouvelle table ni migration.

Casa reprend les débits Appart Casa. Argenteuil utilise les montants confirmés par le propriétaire : prix 126 000 €, promesse 450 €, notaire 10 700 €, prorata 1 496 €, soit 138 646 € hors travaux. Seuls les débits Travaux LMNP ajoutent les travaux au capital, sans double déduction en charge locative. Ils décrivent les mouvements d’acquisition importés, sans estimation de valeur de marché. Des montants absents restent non identifiés. Les investissements explicitement classés peuvent être masqués dans le budget Bankin sans être exclus du suivi du capital. Les exclusions de lignes confirmées dans le snapshot restent respectées.

Les loyers Argenteuil correspondent à la catégorie Loyers reçus (ainsi que l’alias historique Entrée locatif), confirmée par l’utilisateur, après la date d’achat configurée. Les loyers explicitement rattachés à Casa/Maroc vont à Casa. Les débits Charges LMNP sont comptés sur tout l’historique sans couper à la date d’achat ; opérations masquées et exclusions confirmées restent exclues. Les charges d’Argenteuil proviennent exclusivement de la catégorie ou sous-catégorie Charges LMNP, sans déduction à partir des libellés. Les charges Casa utilisent les indices Casa identifiables ; l’achat n’est jamais soustrait une deuxième fois comme charge. Les charges non attribuables à un bien restent hors calcul.

Pour Casa, l’utilisateur a confirmé la reprise du loyer déclaré dans Pilote : 300 €/mois depuis avril 2024, uniquement sur les mois couverts par les données importées. Un loyer Casa trouvé dans Bankin remplace cette déclaration pour le même mois. La déclaration est indiquée séparément dans l’interface.

Le gain locatif correspond aux loyers Bankin et déclarés moins les charges identifiées. Le calcul ne prétend pas mesurer une plus-value de revente ou un gain après fiscalité personnelle. La rentabilité cumulée est le gain net divisé par le capital investi, non annualisée. La couverture de l’investissement utilise également les loyers moins charges sur tout l’historique, même si une année est sélectionnée. Les filtres d’année portent sur les flux locatifs et versements PER ; le montant d’acquisition des biens et le hero restent cumulatifs. Les loyers sont rattachés à leur date bancaire pour Invest.

Les PER reposent sur les catégories PER/PERIN/PERCO/PERCOL/PERP/Épargne retraite et sur les versements confirmés déjà reconnus dans Pilote (novembre 2024, novembre 2025 et septembre 2026). Les autres catégories d’épargne ne sont pas assimilées automatiquement aux PER. Versements nets = débits de versement − crédits de retrait identifiés. Le versement confirmé de 17 000 € à Meryeme en septembre 2026 est également classé PER : correspondance unique dans le mois, ou identification explicite du bénéficiaire en cas de plusieurs montants identiques. Une ambiguïté sans bénéficiaire n’est pas tranchée automatiquement. Aucune valorisation actuelle ou plus-value n’est inventée.

## Validation

Fixtures synthétiques : séparation prix/charges, loyer Casa sans doublon, mois manquants sans extrapolation, PER confirmés et épargne générique distincte, retraits, dates futures, exclusions, données absentes et agrégation annuelle. Tests de route : authentification, restriction par propriétaire, refus d’accès, mode démo et absence de données brutes dans les réponses.
