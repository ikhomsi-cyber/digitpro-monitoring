alter table public.transactions
  add column if not exists bank_name text;

comment on column public.transactions.bank_name is
  'Nom de la banque source, notamment pour les imports Powens.';
