begin;
create table private.integration_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  integration text not null check(integration in ('qonto','powens','gmail')),
  lease uuid, lease_until timestamptz, started_at timestamptz not null,
  primary key(user_id,integration)
);
alter table private.integration_jobs enable row level security;
revoke all on private.integration_jobs from public,anon,authenticated;
grant select,insert,update on private.integration_jobs to service_role;

create function public.integration_job_acquire(p_user_id uuid,p_integration text,p_lease uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
  insert into private.integration_jobs(user_id,integration,lease,lease_until,started_at)
  values(p_user_id,p_integration,p_lease,now()+interval '6 minutes',now())
  on conflict(user_id,integration) do update set lease=excluded.lease,
    lease_until=excluded.lease_until,started_at=excluded.started_at
  where (private.integration_jobs.lease is null or private.integration_jobs.lease_until < now())
    and private.integration_jobs.started_at < now()-interval '1 minute'
  returning lease into claimed;
  return claimed = p_lease;
end; $$;
create function public.integration_job_release(p_user_id uuid,p_integration text,p_lease uuid)
returns void language sql security invoker set search_path='' as $$
  update private.integration_jobs set lease=null,lease_until=null
  where user_id=p_user_id and integration=p_integration and lease=p_lease;
$$;

-- An opaque agent credential is not a Supabase JWT and grants no Data API access.
create table private.agent_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(name) between 1 and 100),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null check(expires_at <= created_at+interval '24 hours'),
  revoked_at timestamptz, created_at timestamptz not null default now(),
  used_calls integer not null default 0, max_calls integer not null default 100 check(max_calls between 1 and 100),
  last_used_at timestamptz
);
create table private.agent_audit (
  id bigint generated always as identity primary key,
  grant_id uuid not null references private.agent_grants(id) on delete cascade,
  request_id uuid not null, tool text not null check(tool='financial_summary'),
  created_at timestamptz not null default now(), outcome text not null,
  unique(grant_id,request_id)
);
alter table private.agent_grants enable row level security;
alter table private.agent_audit enable row level security;
revoke all on private.agent_grants,private.agent_audit from public,anon,authenticated;
grant select,insert,update on private.agent_grants,private.agent_audit to service_role;
grant usage on sequence private.agent_audit_id_seq to service_role;

create function public.agent_authorize(p_hash text,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g private.agent_grants;
begin
  update private.agent_grants set used_calls=used_calls+1,last_used_at=now()
  where token_hash=p_hash and revoked_at is null and expires_at>now() and used_calls<max_calls
    and (last_used_at is null or last_used_at<now()-interval '2 seconds')
  returning * into g;
  if g.id is null then return null; end if;
  insert into private.agent_audit(grant_id,request_id,tool,outcome)
    values(g.id,p_request_id,'financial_summary','authorized');
  return jsonb_build_object('id',g.id,'user_id',g.user_id);
end; $$;
create function public.agent_complete(p_grant_id uuid,p_request_id uuid,p_outcome text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare active boolean;
begin
  if p_outcome not in ('success','failure') then raise exception 'Invalid outcome'; end if;
  select exists(select 1 from private.agent_grants where id=p_grant_id and revoked_at is null and expires_at>now()) into active;
  update private.agent_audit set outcome=case when active then p_outcome else 'revoked' end
    where grant_id=p_grant_id and request_id=p_request_id;
  return active;
end; $$;
create function public.agent_grant_create(p_user_id uuid,p_name text,p_hash text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare grant_id uuid;
begin
  insert into private.agent_grants(user_id,name,token_hash,expires_at)
    values(p_user_id,p_name,p_hash,now()+interval '1 hour') returning id into grant_id;
  return grant_id;
end; $$;
create function public.agent_grant_revoke(p_grant_id uuid)
returns void language sql security invoker set search_path='' as $$
  update private.agent_grants set revoked_at=now() where id=p_grant_id;
$$;
revoke all on function public.integration_job_acquire(uuid,text,uuid),public.integration_job_release(uuid,text,uuid),
  public.agent_authorize(text,uuid),public.agent_complete(uuid,uuid,text),public.agent_grant_create(uuid,text,text),
  public.agent_grant_revoke(uuid) from public,anon,authenticated;
grant execute on function public.integration_job_acquire(uuid,text,uuid),public.integration_job_release(uuid,text,uuid),
  public.agent_authorize(text,uuid),public.agent_complete(uuid,uuid,text),public.agent_grant_create(uuid,text,text),
  public.agent_grant_revoke(uuid) to service_role;
commit;
