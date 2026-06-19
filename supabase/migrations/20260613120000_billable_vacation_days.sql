-- Jours de vacances personnelles (calendrier activité)

create table if not exists public.billable_vacation_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vacation_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, vacation_date)
);

create index if not exists billable_vacation_days_user_date_idx
  on public.billable_vacation_days (user_id, vacation_date);

alter table public.billable_vacation_days enable row level security;

drop policy if exists "billable_vacation_days_select_own" on public.billable_vacation_days;
create policy "billable_vacation_days_select_own"
on public.billable_vacation_days
for select
using (auth.uid() = user_id);

drop policy if exists "billable_vacation_days_insert_own" on public.billable_vacation_days;
create policy "billable_vacation_days_insert_own"
on public.billable_vacation_days
for insert
with check (auth.uid() = user_id);

drop policy if exists "billable_vacation_days_delete_own" on public.billable_vacation_days;
create policy "billable_vacation_days_delete_own"
on public.billable_vacation_days
for delete
using (auth.uid() = user_id);
