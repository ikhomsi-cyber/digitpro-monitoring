-- Périmètre comptable explicite pour séparer les flux SASU et personnels.
-- Les lignes historiques restent dans le périmètre professionnel, comportement
-- déjà appliqué par l'application quand la colonne était absente.
alter table public.transactions
  add column if not exists scope text not null default 'pro'
  check (scope in ('pro', 'personal'));

create index if not exists transactions_user_scope_date_idx
  on public.transactions (user_id, scope, date desc);
