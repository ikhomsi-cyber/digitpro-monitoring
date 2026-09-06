create index if not exists import_sessions_user_format_idx
on public.import_sessions (user_id, format);

create index if not exists transactions_user_import_category_date_idx
on public.transactions (user_id, import_session_id, category, date desc);

-- `scope` is required by the dashboard's SASU/personal split.  Keep this
-- migration self-sufficient so a fresh project can apply the full history.
alter table public.transactions
  add column if not exists scope text not null default 'pro'
  check (scope in ('pro', 'personal'));

create index if not exists transactions_user_scope_date_idx
on public.transactions (user_id, scope, date desc);
