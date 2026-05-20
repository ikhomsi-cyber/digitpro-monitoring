create table if not exists public.billable_rate_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  client_name text not null,
  start_date date not null,
  end_date date,
  tjm_ht numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billable_rate_periods_tjm_positive check (tjm_ht > 0),
  constraint billable_rate_periods_dates_order check (end_date is null or end_date >= start_date)
);

create index if not exists billable_rate_periods_user_dates_idx
on public.billable_rate_periods (user_id, start_date desc, end_date desc);

drop trigger if exists set_billable_rate_periods_updated_at on public.billable_rate_periods;
create trigger set_billable_rate_periods_updated_at
before update on public.billable_rate_periods
for each row execute function public.set_updated_at();

alter table public.billable_rate_periods enable row level security;

drop policy if exists "billable_rate_periods_select_own" on public.billable_rate_periods;
create policy "billable_rate_periods_select_own"
on public.billable_rate_periods
for select
using (auth.uid() = user_id);

drop policy if exists "billable_rate_periods_insert_own" on public.billable_rate_periods;
create policy "billable_rate_periods_insert_own"
on public.billable_rate_periods
for insert
with check (auth.uid() = user_id);

drop policy if exists "billable_rate_periods_update_own" on public.billable_rate_periods;
create policy "billable_rate_periods_update_own"
on public.billable_rate_periods
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "billable_rate_periods_delete_own" on public.billable_rate_periods;
create policy "billable_rate_periods_delete_own"
on public.billable_rate_periods
for delete
using (auth.uid() = user_id);
