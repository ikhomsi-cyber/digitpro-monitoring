-- Stockage du jeton OAuth Gmail (refresh token côté serveur) pour récupérer les factures Hiway.
-- Un seul compte Gmail connecté par utilisateur Supabase.

create table if not exists public.gmail_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  email text,
  refresh_token text not null,
  access_token text,
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists set_gmail_oauth_tokens_updated_at on public.gmail_oauth_tokens;
create trigger set_gmail_oauth_tokens_updated_at
before update on public.gmail_oauth_tokens
for each row execute function public.set_updated_at();

alter table public.gmail_oauth_tokens enable row level security;

drop policy if exists "gmail_oauth_tokens_select_own" on public.gmail_oauth_tokens;
create policy "gmail_oauth_tokens_select_own"
on public.gmail_oauth_tokens
for select
using (auth.uid() = user_id);

drop policy if exists "gmail_oauth_tokens_insert_own" on public.gmail_oauth_tokens;
create policy "gmail_oauth_tokens_insert_own"
on public.gmail_oauth_tokens
for insert
with check (auth.uid() = user_id);

drop policy if exists "gmail_oauth_tokens_update_own" on public.gmail_oauth_tokens;
create policy "gmail_oauth_tokens_update_own"
on public.gmail_oauth_tokens
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "gmail_oauth_tokens_delete_own" on public.gmail_oauth_tokens;
create policy "gmail_oauth_tokens_delete_own"
on public.gmail_oauth_tokens
for delete
using (auth.uid() = user_id);
