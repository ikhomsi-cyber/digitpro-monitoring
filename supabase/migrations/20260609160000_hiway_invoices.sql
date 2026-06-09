-- Factures Hiway récupérées depuis Gmail (cache par utilisateur).

create table if not exists public.hiway_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  gmail_message_id text not null,
  sent_date date not null,
  subject text not null,
  client text,
  amount_ht_eur numeric(12, 2),
  amount_kind text not null default 'HT',
  billed_days numeric(6, 2),
  tjm_ht_eur numeric(10, 2),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index if not exists hiway_invoices_user_sent_date_idx
  on public.hiway_invoices (user_id, sent_date desc);

drop trigger if exists set_hiway_invoices_updated_at on public.hiway_invoices;
create trigger set_hiway_invoices_updated_at
before update on public.hiway_invoices
for each row execute function public.set_updated_at();

alter table public.hiway_invoices enable row level security;

drop policy if exists "hiway_invoices_select_own" on public.hiway_invoices;
create policy "hiway_invoices_select_own"
on public.hiway_invoices for select using (auth.uid() = user_id);

drop policy if exists "hiway_invoices_insert_own" on public.hiway_invoices;
create policy "hiway_invoices_insert_own"
on public.hiway_invoices for insert with check (auth.uid() = user_id);

drop policy if exists "hiway_invoices_update_own" on public.hiway_invoices;
create policy "hiway_invoices_update_own"
on public.hiway_invoices for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "hiway_invoices_delete_own" on public.hiway_invoices;
create policy "hiway_invoices_delete_own"
on public.hiway_invoices for delete using (auth.uid() = user_id);
