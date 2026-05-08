alter table public.desktop_auth_codes
  add column if not exists state text;

update public.desktop_auth_codes
set state = ''
where state is null;

alter table public.desktop_auth_codes
  alter column state set not null;

drop function if exists public.exchange_desktop_auth_code(text, text, text, text, text, text, text, timestamptz, timestamptz);
