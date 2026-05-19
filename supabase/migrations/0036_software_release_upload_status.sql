alter table public.software_releases
  add column if not exists release_status text not null default 'ready';

alter table public.software_releases
  drop constraint if exists software_releases_release_status_check;

alter table public.software_releases
  add constraint software_releases_release_status_check
  check (release_status in ('draft', 'uploading', 'ready', 'failed'));

create index if not exists software_releases_status_idx
  on public.software_releases (release_status, created_at desc);
