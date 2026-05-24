-- Suppression de l’intégration Powens (tokens utilisateur).

drop trigger if exists set_powens_users_updated_at on public.powens_users;

drop policy if exists "powens_users_select_own" on public.powens_users;
drop policy if exists "powens_users_upsert_own" on public.powens_users;
drop policy if exists "powens_users_update_own" on public.powens_users;

drop table if exists public.powens_users;
