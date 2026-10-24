begin;
create table public.grocery_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 merchant text not null check (merchant in ('Carrefour','Auchan','E.Leclerc','Intermarché','Courses U')),
 order_ref text not null check (length(order_ref) between 4 and 100),
 ordered_at date not null,
 total_cents bigint check (total_cents between 0 and 100000000),
 items jsonb not null default '[]' check (jsonb_typeof(items)='array' and jsonb_array_length(items)<=500 and octet_length(items::text)<=500000),
 gmail_account text not null check (gmail_account in ('primary','secondary')),
 gmail_message_id text not null check (length(gmail_message_id) between 1 and 200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,merchant,order_ref)
);
create index grocery_orders_user_date_idx on public.grocery_orders(user_id,ordered_at desc);
create trigger set_grocery_orders_updated_at before update on public.grocery_orders for each row execute function public.set_updated_at();
alter table public.grocery_orders enable row level security;
revoke all on public.grocery_orders from public,anon,authenticated;
grant select,insert,update on public.grocery_orders to authenticated;
grant all on public.grocery_orders to service_role;
create policy grocery_orders_select on public.grocery_orders for select to authenticated using ((select auth.uid())=user_id);
create policy grocery_orders_insert on public.grocery_orders for insert to authenticated with check ((select auth.uid())=user_id);
create policy grocery_orders_update on public.grocery_orders for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
commit;
