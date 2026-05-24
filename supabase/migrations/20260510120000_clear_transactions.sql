-- Vide la table des transactions et les métriques mensuelles dérivées (tous les comptes).
-- À exécuter une fois dans l’éditeur SQL Supabase ou via `supabase db push`.
-- Optionnel : historique d’imports CSV — décommentez la dernière ligne pour tout effacer.

delete from public.transactions;

delete from public.monthly_metrics;

-- delete from public.import_sessions;
