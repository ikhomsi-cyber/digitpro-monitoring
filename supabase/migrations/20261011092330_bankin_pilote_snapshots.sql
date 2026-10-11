-- Only aggregates from the most recent Bankin workbook; no email links, tokens or transaction labels.
create table public.bankin_pilote_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 2000000),
  updated_at timestamptz not null default now()
);
alter table public.bankin_pilote_snapshots enable row level security;
revoke all on public.bankin_pilote_snapshots from public, anon, authenticated;
grant select, insert, update on public.bankin_pilote_snapshots to authenticated;
create policy bankin_pilote_select on public.bankin_pilote_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy bankin_pilote_insert on public.bankin_pilote_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy bankin_pilote_update on public.bankin_pilote_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
