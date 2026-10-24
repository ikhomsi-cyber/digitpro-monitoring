-- Add a second encrypted Gmail slot without altering or re-encrypting the existing account.
-- Deploy this additive migration before the matching server release.
begin;
create table private.gmail_secondary_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  refresh_token text not null check (refresh_token like 'enc:v1:%'),
  access_token text check (access_token is null or access_token like 'enc:v1:%'),
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.gmail_secondary_tokens enable row level security;
revoke all on private.gmail_secondary_tokens from public, anon, authenticated;
grant select, insert, update, delete on private.gmail_secondary_tokens to service_role;
create trigger set_gmail_secondary_tokens_updated_at before update on private.gmail_secondary_tokens
for each row execute function public.set_updated_at();
create or replace function public.integration_secret_read(p_user_id uuid, p_integration text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_integration = 'gmail' then
    select to_jsonb(t) into result from private.gmail_oauth_tokens t where user_id = p_user_id;
  elsif p_integration = 'gmail-secondary' then
    select to_jsonb(t) into result from private.gmail_secondary_tokens t where user_id = p_user_id;
  elsif p_integration = 'powens' then
    select to_jsonb(t) into result from private.powens_users t where user_id = p_user_id;
  else raise exception 'Invalid integration'; end if;
  return result;
end; $$;

create or replace function public.integration_secret_write(p_user_id uuid, p_integration text, p_values jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_integration in ('gmail','gmail-secondary') then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 71016));
    if (p_integration = 'gmail' and exists(select 1 from private.gmail_secondary_tokens where user_id=p_user_id and lower(email)=lower(p_values->>'email')))
      or (p_integration = 'gmail-secondary' and exists(select 1 from private.gmail_oauth_tokens where user_id=p_user_id and lower(email)=lower(p_values->>'email'))) then
      raise exception 'Gmail account already connected';
    end if;
  end if;
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
  elsif p_integration = 'gmail-secondary' then
    if coalesce(p_values->>'refresh_token', '') not like 'enc:v1:%' or
      (p_values->>'access_token' is not null and p_values->>'access_token' not like 'enc:v1:%') then
      raise exception 'Encrypted tokens required';
    end if;
    insert into private.gmail_secondary_tokens(user_id,email,refresh_token,access_token,token_expiry,scope)
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

create or replace function public.integration_secret_delete(p_user_id uuid, p_integration text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_integration = 'gmail' then delete from private.gmail_oauth_tokens where user_id=p_user_id;
  elsif p_integration = 'gmail-secondary' then delete from private.gmail_secondary_tokens where user_id=p_user_id;
  elsif p_integration = 'powens' then delete from private.powens_users where user_id=p_user_id;
  else raise exception 'Invalid integration'; end if;
end; $$;

revoke all on function public.integration_secret_read(uuid,text),
  public.integration_secret_write(uuid,text,jsonb), public.integration_secret_delete(uuid,text)
  from public, anon, authenticated;
grant execute on function public.integration_secret_read(uuid,text),
  public.integration_secret_write(uuid,text,jsonb), public.integration_secret_delete(uuid,text)
  to service_role;

commit;
