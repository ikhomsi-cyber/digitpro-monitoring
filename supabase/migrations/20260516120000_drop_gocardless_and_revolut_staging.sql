-- Supprime l’Open Banking GoCardless et les tables de staging Revolut personnel (plus utilisées par l’app).

drop table if exists public.revolut_personal_transactions cascade;
drop table if exists public.revolut_personal_accounts cascade;
drop table if exists public.gocardless_bank_data_users cascade;
