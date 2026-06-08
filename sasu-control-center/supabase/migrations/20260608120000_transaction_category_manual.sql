-- Manual category choices must survive re-imports and override auto heuristics.
alter table public.transactions
  add column if not exists category_manual boolean not null default false;

create index if not exists transactions_user_category_manual_idx
  on public.transactions (user_id, category_manual)
  where category_manual = true;
