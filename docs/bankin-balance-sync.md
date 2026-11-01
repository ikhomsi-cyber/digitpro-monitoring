# Historique des soldes Bankin

## Comportement

Le cache est chargé à l’ouverture, sans appel Gmail. Le bouton Collecter démarre une première collecte persistante. Les sujets ciblés sont « Balance quotidienne » et « Vos soldes quotidiens », uniquement chez Bankin.

La date du premier email est découverte par recherches de présence, sans télécharger tous les messages. Un seul email par fenêtre hebdomadaire est ensuite téléchargé. Tous ses comptes sont conservés ; l’API de présentation ne renvoie que Fortuneo. Aucun email brut, lien, jeton OAuth ni pièce jointe n’est stocké.

Après le rattrapage, les imports Gmail Bankin réussis déclenchent une collecte incrémentale. Elle traite les nouveaux identifiants, avec un chevauchement de deux jours pour couvrir les arrivées proches de la borne temporelle. Les identifiants déjà traités ne sont pas relus. La borne n’avance qu’une fois toutes les pages traitées. Une collecte interrompue reprend à son dernier checkpoint, y compris après rechargement.

Chaque étape comporte au plus une requête Gmail et est sauvegardée avant la suivante. La progression est liée au propriétaire, à l’emplacement Gmail et à une empreinte de la boîte connectée. Une reconnexion de la même boîte conserve l’historique ; une autre boîte ne réutilise pas ses curseurs. Une révision et un bail empêchent les écrasements concurrents.

Les refus 401/403 arrêtent immédiatement la collecte. Aucun autre compte ni identité n’est essayé. Une pause quota est enregistrée et ne déclenche pas de nouvelle tentative automatique. Une collecte de soldes interrompue n’annule pas l’import de transactions déjà enregistré. Les emails non reconnus sont comptés et signalés.

## Calcul affiché

« الزكاة » utilise la formule demandée : 2,5 % du minimum annuel observé de la somme des comptes Fortuneo. Chaque date utilise uniquement le dernier email reçu ce jour-là : les comptes peuvent s’ouvrir ou se fermer au fil des années, sans mélanger plusieurs relevés. Les anciennes données sans horodatage restent traitées de façon conservatrice. Le minimum est planché à zéro pour ce calcul. Un historique hebdomadaire ou incomplet ne garantit pas le minimum réel de chaque jour : le résultat est affiché comme estimation.

## Installation

Appliquer `supabase/migrations/20261101072458_bankin_balance_history.sql` dans la base correspondant au serveur avant d’activer cette version. La migration crée uniquement `public.bankin_balance_sync` avec RLS par propriétaire ; elle ne modifie aucune table de transactions ni aucun secret. Les permissions de lecture, insertion, mise à jour et suppression sont réservées au propriétaire authentifié. Aucun déploiement ni application de migration en production n’est effectué par les tests.

Les tests PGlite appliquent cette migration dans une base synthétique et vérifient l’isolation interutilisateurs, les refus anonymes et les révisions concurrentes. Les tests de synchronisation couvrent le rattrapage, la reprise après sérialisation, les erreurs Google, le filtrage Fortuneo et les doublons.

## Import historique Excel

Le mode « Excel : ajouter uniquement les manquantes » ignore les transactions déjà identifiées, sans rafraîchir leurs catégories, soldes ou masquages. La fusion Pilote ajoute les occurrences absentes et respecte les exclusions déjà enregistrées. Réimporter le même export reste idempotent. Le mode normal reste disponible en décochant l’option.

## Validation du 1er novembre 2026

La migration a été appliquée au projet DigitPro `qaahqwepkroiuyjqvnzh` après autorisation explicite de l’utilisateur. Vérification des métadonnées : RLS activée, quatre politiques propriétaire, SELECT anonyme refusé. Aucun secret ni transaction existante n’a été modifié.

La collecte réelle autorisée a sauvegardé 96 relevés, puis s’est arrêtée au refus de quota Google. Un rechargement de Pilote retrouve les relevés et le point de reprise ; aucun nouvel appel Gmail n’est déclenché par cette lecture du cache. Le rattrapage reste incomplet.

L’import Excel historique n’a pas été exécuté : l’outil de navigation n’a pas pu sélectionner le fichier. Le mode additif est testé et disponible ; le propriétaire doit sélectionner l’export via le bouton Excel avec l’option d’ajout uniquement cochée.

L’audit de dépendances conserve cinq alertes modérées préexistantes, sans niveau haut ou critique. Le conseiller Supabase ne signale pas de problème sur la nouvelle table. Il conserve l’alerte Auth préexistante [protection des mots de passe compromis désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) ; aucun paramètre d’administration de sécurité n’a été changé. Les notices RLS des tables privées sans politiques correspondent à leur accès navigateur refusé et ne sont pas corrigées en ouvrant ces tables.
