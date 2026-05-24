-- Réintègre le stockage du couple utilisateur Powens cloud ↔ utilisateur Supabase (token côté serveur uniquement).

create table if not exists public.powens_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  powens_user_id text not null,
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

drop policy if exists "powens_users_insert_own" on public.powens_users;
create policy "powens_users_insert_own"
on public.powens_users
for insert
with check (auth.uid() = user_id);

drop policy if exists "powens_users_update_own" on public.powens_users;
create policy "powens_users_update_own"
on public.powens_users
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "powens_users_upsert_own" on public.powens_users;

alter table public.import_sessions drop constraint if exists import_sessions_format_check;

alter table public.import_sessions
  add constraint import_sessions_format_check
  check (format in ('qonto', 'generic', 'bankin', 'powens'));
