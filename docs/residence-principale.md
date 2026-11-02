# RP — résidence principale

Bloc intégré dans Invest (`section=invest`), sans onglet RP séparé. Objectif fixé par le propriétaire : 400 000 €.

Le total additionne le dernier solde Fortuneo enregistré dans les relevés Bankin du Gmail principal et les versements PER nets identifiés par Invest. Les données sont lues via les deux routes authentifiées existantes, en parallèle, sans collecte Gmail ni appel bancaire. Aucun cache persistant côté navigateur. Une source manquante laisse le total inconnu plutôt que de la remplacer par zéro.

Le solde Fortuneo affiche sa date d’observation. Le PER utilise les contributions nettes importées, sans valeur de marché ni estimation de disponibilité immédiate. Le reste à constituer est `max(0, 400000 − total)`. Le pourcentage conserve un éventuel dépassement ; la barre est bornée entre 0 et 100 %.

Les requêtes sont annulées au démontage. Le mode démonstration utilise uniquement des valeurs synthétiques et n’appelle pas les routes réelles.
