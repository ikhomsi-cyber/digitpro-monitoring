-- Autorise les sessions d’import depuis un export Bankin (.xls / .xlsx).

alter table public.import_sessions drop constraint if exists import_sessions_format_check;

alter table public.import_sessions
  add constraint import_sessions_format_check
  check (format in ('qonto', 'generic', 'bankin'));
