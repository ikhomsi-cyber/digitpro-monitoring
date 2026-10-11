-- Deploy together with the server credential helpers and re-encrypt existing tokens.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

alter table public.gmail_oauth_tokens set schema private;
alter table public.powens_users set schema private;
revoke all on private.gmail_oauth_tokens, private.powens_users from public, anon, authenticated;
grant select, insert, update, delete on private.gmail_oauth_tokens, private.powens_users to service_role;

-- Invoker privileges: only the backend service role can call these fixed operations.
create function public.integration_secret_read(p_user_id uuid, p_integration text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_integration = 'gmail' then
    select to_jsonb(t) into result from private.gmail_oauth_tokens t where user_id = p_user_id;
  elsif p_integration = 'powens' then
    select to_jsonb(t) into result from private.powens_users t where user_id = p_user_id;
  else raise exception 'Invalid integration'; end if;
  return result;
end; $$;

create function public.integration_secret_write(p_user_id uuid, p_integration text, p_values jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_integration = 'gmail' then
    if coalesce(p_values->>'refresh_token', '') not like 'enc:v1:%' or
      (p_values->>'access_token' is not null and p_values->>'access_token' not like 'enc:v1:%') then
      raise exception 'Encrypted tokens required';
    end if;
    insert into private.gmail_oauth_tokens(user_id,email,refresh_token,access_token,token_expiry,scope)
    values(p_user_id,p_values->>'email',p_values->>'refresh_token',p_values->>'access_token',
      (p_values->>'token_expiry')::timestamptz,p_values->>'scope')
    on conflict(user_id) do update set email=excluded.email, refresh_token=excluded.refresh_token,
      access_token=excluded.access_token,token_expiry=excluded.token_expiry,scope=excluded.scope;
  elsif p_integration = 'powens' then
    if coalesce(p_values->>'auth_token', '') not like 'enc:v1:%' then raise exception 'Encrypted tokens required'; end if;
    insert into private.powens_users(user_id,powens_user_id,auth_token)
    values(p_user_id,p_values->>'powens_user_id',p_values->>'auth_token')
    on conflict(user_id) do update set powens_user_id=excluded.powens_user_id,auth_token=excluded.auth_token;
  else raise exception 'Invalid integration'; end if;
end; $$;

create function public.integration_secret_delete(p_user_id uuid, p_integration text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_integration = 'gmail' then delete from private.gmail_oauth_tokens where user_id=p_user_id;
  elsif p_integration = 'powens' then delete from private.powens_users where user_id=p_user_id;
  else raise exception 'Invalid integration'; end if;
end; $$;

revoke all on function public.integration_secret_read(uuid,text),
  public.integration_secret_write(uuid,text,jsonb), public.integration_secret_delete(uuid,text)
  from public, anon, authenticated;
grant execute on function public.integration_secret_read(uuid,text),
  public.integration_secret_write(uuid,text,jsonb), public.integration_secret_delete(uuid,text)
  to service_role;

-- Repair missing expense_notes table observed in production despite recorded migration.
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

drop policy if exists expense_notes_delete_own on public.expense_notes;
create policy expense_notes_delete_own on public.expense_notes for delete to authenticated using(auth.uid()=user_id);
grant select,insert,delete on public.expense_notes to authenticated;
grant all on public.expense_notes to service_role;
alter function public.set_updated_at() set search_path = '';

-- Enforce ownership across references, including writes made directly via the Data API.
drop policy if exists expense_notes_insert_own on public.expense_notes;
create policy expense_notes_insert_own on public.expense_notes for insert to authenticated
with check (auth.uid() = user_id and exists (
  select 1 from public.transactions t where t.id=transaction_id and t.user_id=auth.uid()
));

create function private.check_transaction_import_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.import_session_id is not null and not exists (
    select 1 from public.import_sessions s where s.id=new.import_session_id and s.user_id=new.user_id
  ) then raise exception 'Invalid import session'; end if;
  return new;
end; $$;
create trigger check_transaction_import_owner before insert or update of import_session_id,user_id
on public.transactions for each row execute function private.check_transaction_import_owner();
commit;
