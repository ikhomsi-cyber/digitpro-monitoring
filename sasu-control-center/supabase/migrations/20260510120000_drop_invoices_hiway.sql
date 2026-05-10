-- Supprime la table des factures (sync portail Hiway + saisie manuelle), devenue inutile côté app.
drop policy if exists "invoices_delete_own" on public.invoices;
drop policy if exists "invoices_update_own" on public.invoices;
drop policy if exists "invoices_insert_own" on public.invoices;
drop policy if exists "invoices_select_own" on public.invoices;
drop trigger if exists set_invoices_updated_at on public.invoices;
drop table if exists public.invoices;
