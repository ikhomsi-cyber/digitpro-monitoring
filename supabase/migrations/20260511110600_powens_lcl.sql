-- Powens (Budget Insight) integration: store auth token + LCL accounts/transactions (separate tables)

create table if not exists public.powens_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  powens_user_id int,
  auth_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists set_powens_users_updated_at on public.powens_users;
create trigger set_powens_users_updated_at
before update on public.powens_users
for each row execute function public.set_updated_at();

alter table public.powens_users enable row level security;

drop policy if exists "powens_users_select_own" on public.powens_users;
create policy "powens_users_select_own"
on public.powens_users
for select
using (auth.uid() = user_id);

drop policy if exists "powens_users_upsert_own" on public.powens_users;
create policy "powens_users_upsert_own"
on public.powens_users
for insert
with check (auth.uid() = user_id);

drop policy if exists "powens_users_update_own" on public.powens_users;
create policy "powens_users_update_own"
on public.powens_users
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Accounts (keep raw json for extra metadata)
create table if not exists public.lcl_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  powens_account_id text not null,
  connection_id text,
  label text not null default '',
  iban text,
  balance numeric,
  currency text not null default 'EUR',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, powens_account_id)
);

create index if not exists lcl_accounts_user_powens_idx
on public.lcl_accounts (user_id, powens_account_id);

drop trigger if exists set_lcl_accounts_updated_at on public.lcl_accounts;
create trigger set_lcl_accounts_updated_at
before update on public.lcl_accounts
for each row execute function public.set_updated_at();

alter table public.lcl_accounts enable row level security;

drop policy if exists "lcl_accounts_select_own" on public.lcl_accounts;
create policy "lcl_accounts_select_own"
on public.lcl_accounts
for select
using (auth.uid() = user_id);

drop policy if exists "lcl_accounts_insert_own" on public.lcl_accounts;
create policy "lcl_accounts_insert_own"
on public.lcl_accounts
for insert
with check (auth.uid() = user_id);

drop policy if exists "lcl_accounts_update_own" on public.lcl_accounts;
create policy "lcl_accounts_update_own"
on public.lcl_accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Transactions (keep raw json for extra metadata)
create table if not exists public.lcl_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  powens_transaction_id text not null,
  powens_account_id text not null,
  connection_id text,
  date date not null,
  rdate date,
  label text not null default '',
  amount numeric not null,
  category text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, powens_transaction_id)
);

create index if not exists lcl_transactions_user_date_idx
on public.lcl_transactions (user_id, date desc);

create index if not exists lcl_transactions_user_account_date_idx
on public.lcl_transactions (user_id, powens_account_id, date desc);

drop trigger if exists set_lcl_transactions_updated_at on public.lcl_transactions;
create trigger set_lcl_transactions_updated_at
before update on public.lcl_transactions
for each row execute function public.set_updated_at();

alter table public.lcl_transactions enable row level security;

drop policy if exists "lcl_transactions_select_own" on public.lcl_transactions;
create policy "lcl_transactions_select_own"
on public.lcl_transactions
for select
using (auth.uid() = user_id);

drop policy if exists "lcl_transactions_insert_own" on public.lcl_transactions;
create policy "lcl_transactions_insert_own"
on public.lcl_transactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "lcl_transactions_update_own" on public.lcl_transactions;
create policy "lcl_transactions_update_own"
on public.lcl_transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

