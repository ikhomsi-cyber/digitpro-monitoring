-- Supprime la table legacy public.invoices (non utilisée par l’app ; CA / jours facturés viennent de la trésorerie).
drop policy if exists "invoices_delete_own" on public.invoices;
drop policy if exists "invoices_update_own" on public.invoices;
drop policy if exists "invoices_insert_own" on public.invoices;
drop policy if exists "invoices_select_own" on public.invoices;
drop trigger if exists set_invoices_updated_at on public.invoices;
drop table if exists public.invoices;
