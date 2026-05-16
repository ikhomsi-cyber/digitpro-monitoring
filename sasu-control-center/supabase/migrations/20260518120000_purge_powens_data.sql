-- Purge toutes les données Powens (à exécuter dans l’éditeur SQL Supabase ou via `supabase db push`).
-- Conserve la structure des tables ; supprime uniquement les lignes.

-- 1) Transactions importées via Powens (liées à une session format = powens)
delete from public.transactions t
using public.import_sessions s
where t.import_session_id = s.id
  and s.format = 'powens';

-- 2) Historique d’import Powens
delete from public.import_sessions
where format = 'powens';

-- 3) Jetons / mapping utilisateur Powens
delete from public.powens_users;

-- 4) Tables legacy LCL / Revolut perso (si encore présentes)
do $$
begin
  if to_regclass('public.lcl_transactions') is not null then
    delete from public.lcl_transactions;
  end if;
  if to_regclass('public.lcl_accounts') is not null then
    delete from public.lcl_accounts;
  end if;
  if to_regclass('public.revolut_personal_transactions') is not null then
    delete from public.revolut_personal_transactions;
  end if;
  if to_regclass('public.revolut_personal_accounts') is not null then
    delete from public.revolut_personal_accounts;
  end if;
end $$;

-- Recalcul des agrégats mensuels : supprimez puis rechargez le dashboard ou relancez un import.
delete from public.monthly_metrics;
