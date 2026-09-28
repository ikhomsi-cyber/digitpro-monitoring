-- Préserve l’échéance réelle indiquée dans les emails de facture Hiway.
alter table public.hiway_invoices add column if not exists due_date date;
