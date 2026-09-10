alter table public.import_sessions
  add column if not exists file_hash text;

create unique index if not exists import_sessions_user_file_hash_uidx
  on public.import_sessions (user_id, file_hash)
  where file_hash is not null;

notify pgrst, 'reload schema';
