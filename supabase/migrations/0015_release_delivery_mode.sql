alter table public.software_releases
  add column if not exists delivery_mode text not null default 'file',
  add column if not exists macos_primary_url text,
  add column if not exists macos_backup_url text,
  add column if not exists windows_primary_url text,
  add column if not exists windows_backup_url text;

alter table public.software_releases
  drop constraint if exists software_releases_delivery_mode_check;

alter table public.software_releases
  add constraint software_releases_delivery_mode_check
  check (delivery_mode in ('file', 'link'));
