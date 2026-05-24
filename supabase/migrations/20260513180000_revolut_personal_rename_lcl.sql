-- Powens : tables LCL renommées en Revolut personnel (même connecteur Powens, autre banque dans la webview).

do $$
begin
  if to_regclass('public.lcl_accounts') is not null
     and to_regclass('public.revolut_personal_accounts') is null then
    alter table public.lcl_accounts rename to revolut_personal_accounts;
  end if;
end $$;

do $$
begin
  if to_regclass('public.lcl_transactions') is not null
     and to_regclass('public.revolut_personal_transactions') is null then
    alter table public.lcl_transactions rename to revolut_personal_transactions;
  end if;
end $$;

-- Renommage des index pour clarté (si les anciens noms existent encore)
alter index if exists lcl_accounts_user_powens_idx rename to revolut_personal_accounts_user_powens_idx;
alter index if exists lcl_transactions_user_date_idx rename to revolut_personal_transactions_user_date_idx;
alter index if exists lcl_transactions_user_account_date_idx rename to revolut_personal_transactions_user_account_date_idx;
