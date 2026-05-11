-- Jours travaillés (calendrier TJM) + TJM HT utilisateur
-- Exécutable seul dans le SQL Editor Supabase (définit aussi set_updated_at si absent).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_billable_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tjm_ht numeric not null default 820,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billable_work_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index if not exists billable_work_days_user_date_idx on public.billable_work_days (user_id, work_date);

alter table public.user_billable_settings alter column user_id set default auth.uid();

drop trigger if exists set_user_billable_settings_updated_at on public.user_billable_settings;
create trigger set_user_billable_settings_updated_at
before update on public.user_billable_settings
for each row execute function public.set_updated_at();

alter table public.user_billable_settings enable row level security;
alter table public.billable_work_days enable row level security;

drop policy if exists "user_billable_settings_select_own" on public.user_billable_settings;
create policy "user_billable_settings_select_own"
on public.user_billable_settings
for select
using (auth.uid() = user_id);

drop policy if exists "user_billable_settings_insert_own" on public.user_billable_settings;
create policy "user_billable_settings_insert_own"
on public.user_billable_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_billable_settings_update_own" on public.user_billable_settings;
create policy "user_billable_settings_update_own"
on public.user_billable_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "billable_work_days_select_own" on public.billable_work_days;
create policy "billable_work_days_select_own"
on public.billable_work_days
for select
using (auth.uid() = user_id);

drop policy if exists "billable_work_days_insert_own" on public.billable_work_days;
create policy "billable_work_days_insert_own"
on public.billable_work_days
for insert
with check (auth.uid() = user_id);

drop policy if exists "billable_work_days_delete_own" on public.billable_work_days;
create policy "billable_work_days_delete_own"
on public.billable_work_days
for delete
using (auth.uid() = user_id);
