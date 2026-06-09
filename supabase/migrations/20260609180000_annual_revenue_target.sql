-- Objectif annuel de CA HT (suivi dashboard)
alter table public.user_billable_settings
  add column if not exists annual_revenue_target_ht numeric;

comment on column public.user_billable_settings.annual_revenue_target_ht is
  'Objectif de chiffre d''affaires HT pour l''année civile en cours (dashboard).';
