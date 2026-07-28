-- Jours avec trajet domicile-travail en voiture et kilomètres professionnels additionnels.

create table if not exists public.billable_commute_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  commute_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, commute_date)
);

create table if not exists public.billable_mileage_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_date date not null,
  extra_km numeric not null check (extra_km >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_date)
);

create index if not exists billable_commute_days_user_date_idx
  on public.billable_commute_days (user_id, commute_date);

alter table public.billable_commute_days enable row level security;
alter table public.billable_mileage_adjustments enable row level security;

create policy "billable_commute_days_own"
on public.billable_commute_days for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "billable_mileage_adjustments_own"
on public.billable_mileage_adjustments for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_billable_mileage_adjustments_updated_at on public.billable_mileage_adjustments;
create trigger set_billable_mileage_adjustments_updated_at
before update on public.billable_mileage_adjustments
for each row execute function public.set_updated_at();
