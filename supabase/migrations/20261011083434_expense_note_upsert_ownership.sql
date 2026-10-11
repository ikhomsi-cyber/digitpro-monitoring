-- Supabase/PostgREST upsert needs UPDATE permission as well as INSERT and SELECT.
begin;
grant update on public.expense_notes to authenticated;
drop policy if exists expense_notes_update_own on public.expense_notes;
create policy expense_notes_update_own on public.expense_notes
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and exists (
  select 1 from public.transactions t
  where t.id = transaction_id and t.user_id = (select auth.uid())
));
commit;
