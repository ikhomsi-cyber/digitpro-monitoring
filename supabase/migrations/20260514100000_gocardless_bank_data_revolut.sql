-- GoCardless Bank Account Data (ex-Nordigen) — liaison Revolut personnel (requisition Open Banking)

create table if not exists public.gocardless_bank_data_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  requisition_id text not null,
  institution_id text not null default '',
  agreement_id text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists set_gocardless_bank_data_users_updated_at on public.gocardless_bank_data_users;
create trigger set_gocardless_bank_data_users_updated_at
before update on public.gocardless_bank_data_users
for each row execute function public.set_updated_at();

alter table public.gocardless_bank_data_users enable row level security;

drop policy if exists "gocardless_bank_data_users_select_own" on public.gocardless_bank_data_users;
create policy "gocardless_bank_data_users_select_own"
on public.gocardless_bank_data_users
for select
using (auth.uid() = user_id);

drop policy if exists "gocardless_bank_data_users_insert_own" on public.gocardless_bank_data_users;
create policy "gocardless_bank_data_users_insert_own"
on public.gocardless_bank_data_users
for insert
with check (auth.uid() = user_id);

drop policy if exists "gocardless_bank_data_users_update_own" on public.gocardless_bank_data_users;
create policy "gocardless_bank_data_users_update_own"
on public.gocardless_bank_data_users
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
