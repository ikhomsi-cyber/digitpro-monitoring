-- Supprime toutes les lignes de public.transactions (tous les comptes / utilisateurs du projet).
-- Exécution : Supabase Dashboard → SQL Editor → coller ce fichier → Run.
-- Rôle « postgres » : contourne la RLS ; à réserver à un environnement que vous contrôlez.
--
-- Les tags expense_notes référencent transactions avec ON DELETE CASCADE : ils sont
-- supprimés automatiquement avec les transactions.
--
-- Les métriques mensuelles dérivées sont vidées pour éviter un dashboard incohérent.

begin;

delete from public.transactions;

delete from public.monthly_metrics;

-- Décommentez pour aussi effacer l’historique des sessions d’import (Qonto, Powens, fichiers, etc.) :
-- delete from public.import_sessions;

commit;
