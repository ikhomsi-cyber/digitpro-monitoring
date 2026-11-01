begin;
create table public.bankin_balance_sync (
 user_id uuid not null references auth.users(id) on delete cascade,
 gmail_account text not null check (gmail_account in ('primary','secondary')),
 mailbox_key text not null check (mailbox_key ~ '^[a-f0-9]{64}$'),
 snapshot jsonb not null check (jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<2000000),
 revision bigint not null default 0 check (revision>=0),
 lease_id uuid, lease_until timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,gmail_account,mailbox_key)
);
alter table public.bankin_balance_sync enable row level security;
revoke all on public.bankin_balance_sync from public,anon;
grant select,insert,update,delete on public.bankin_balance_sync to authenticated;
create policy balance_owner_select on public.bankin_balance_sync for select to authenticated using ((select auth.uid())=user_id);
create policy balance_owner_insert on public.bankin_balance_sync for insert to authenticated with check ((select auth.uid())=user_id);
create policy balance_owner_update on public.bankin_balance_sync for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy balance_owner_delete on public.bankin_balance_sync for delete to authenticated using ((select auth.uid())=user_id);
commit;
