-- DigitPro Consultion Monitoring — Supabase schema (production-friendly baseline)
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

-- Transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  label text not null,
  category text not null,
  amount numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

-- Monthly metrics (stored values for charts)
create table if not exists public.monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  revenue numeric not null default 0,
  expenses numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists monthly_metrics_user_month_idx on public.monthly_metrics (user_id, month);

-- Salary simulations history
create table if not exists public.salary_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  salary_net numeric not null,
  company_cost_estimate numeric not null,
  cash_available_at_time numeric not null,
  remaining_cash_estimate numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists salary_simulations_user_created_idx on public.salary_simulations (user_id, created_at desc);

-- Ensure user_id defaults to authenticated user.
alter table public.transactions alter column user_id set default auth.uid();
alter table public.monthly_metrics alter column user_id set default auth.uid();
alter table public.salary_simulations alter column user_id set default auth.uid();

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_monthly_metrics_updated_at on public.monthly_metrics;
create trigger set_monthly_metrics_updated_at
before update on public.monthly_metrics
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.transactions enable row level security;
alter table public.monthly_metrics enable row level security;
alter table public.salary_simulations enable row level security;

-- Policies: transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions
for select
using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
on public.transactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
on public.transactions
for delete
using (auth.uid() = user_id);

-- Policies: monthly_metrics
drop policy if exists "monthly_metrics_select_own" on public.monthly_metrics;
create policy "monthly_metrics_select_own"
on public.monthly_metrics
for select
using (auth.uid() = user_id);

drop policy if exists "monthly_metrics_insert_own" on public.monthly_metrics;
create policy "monthly_metrics_insert_own"
on public.monthly_metrics
for insert
with check (auth.uid() = user_id);

drop policy if exists "monthly_metrics_update_own" on public.monthly_metrics;
create policy "monthly_metrics_update_own"
on public.monthly_metrics
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "monthly_metrics_delete_own" on public.monthly_metrics;
create policy "monthly_metrics_delete_own"
on public.monthly_metrics
for delete
using (auth.uid() = user_id);

-- Policies: salary_simulations
drop policy if exists "salary_simulations_select_own" on public.salary_simulations;
create policy "salary_simulations_select_own"
on public.salary_simulations
for select
using (auth.uid() = user_id);

drop policy if exists "salary_simulations_insert_own" on public.salary_simulations;
create policy "salary_simulations_insert_own"
on public.salary_simulations
for insert
with check (auth.uid() = user_id);

drop policy if exists "salary_simulations_delete_own" on public.salary_simulations;
create policy "salary_simulations_delete_own"
on public.salary_simulations
for delete
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- CSV import sessions + deduplicated imports (run on existing projects too)
-- ---------------------------------------------------------------------------

create table if not exists public.import_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  source_filename text,
  file_hash text,
  format text not null check (format in ('qonto', 'generic')),
  row_count int not null default 0,
  inserted_count int not null default 0,
  skipped_duplicate_count int not null default 0,
  merged_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists import_sessions_user_created_idx on public.import_sessions (user_id, created_at desc);

alter table public.import_sessions add column if not exists merged_count int not null default 0;
alter table public.import_sessions add column if not exists file_hash text;

alter table public.import_sessions alter column user_id set default auth.uid();

alter table public.transactions add column if not exists content_hash text;
alter table public.transactions add column if not exists import_session_id uuid references public.import_sessions (id) on delete set null;
alter table public.transactions add column if not exists company text not null default '';
alter table public.transactions add column if not exists balance numeric;

create index if not exists transactions_user_company_date_idx on public.transactions (user_id, company, date desc);

create unique index if not exists transactions_user_content_hash_uidx
on public.transactions (user_id, content_hash)
where content_hash is not null;

create unique index if not exists import_sessions_user_file_hash_uidx
on public.import_sessions (user_id, file_hash)
where file_hash is not null;

alter table public.import_sessions enable row level security;

drop policy if exists "import_sessions_select_own" on public.import_sessions;
create policy "import_sessions_select_own"
on public.import_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "import_sessions_insert_own" on public.import_sessions;
create policy "import_sessions_insert_own"
on public.import_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "import_sessions_update_own" on public.import_sessions;
create policy "import_sessions_update_own"
on public.import_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
