-- Tags « note de frais » / « repas client » sur transactions
-- Table séparée : 1 transaction peut avoir plusieurs tags (unique user_id + transaction_id + tag)

create table if not exists public.expense_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  tag text not null check (tag in ('note_de_frais', 'repas_client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, transaction_id, tag)
);

create index if not exists expense_notes_user_tx_idx
on public.expense_notes (user_id, transaction_id);

drop trigger if exists set_expense_notes_updated_at on public.expense_notes;
create trigger set_expense_notes_updated_at
before update on public.expense_notes
for each row execute function public.set_updated_at();

alter table public.expense_notes enable row level security;

drop policy if exists "expense_notes_select_own" on public.expense_notes;
create policy "expense_notes_select_own"
on public.expense_notes
for select
using (auth.uid() = user_id);

drop policy if exists "expense_notes_insert_own" on public.expense_notes;
create policy "expense_notes_insert_own"
on public.expense_notes
for insert
with check (auth.uid() = user_id);

drop policy if exists "expense_notes_delete_own" on public.expense_notes;
create policy "expense_notes_delete_own"
on public.expense_notes
for delete
using (auth.uid() = user_id);

