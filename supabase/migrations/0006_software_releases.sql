create type software_release_platform as enum ('macos', 'windows');

create table public.software_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  released_at date not null,
  notes text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.software_release_assets (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.software_releases(id) on delete cascade,
  platform software_release_platform not null,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  created_at timestamptz not null default now(),
  unique (release_id, platform)
);

create index software_releases_published_date_idx on public.software_releases (is_published, released_at desc, created_at desc);
create index software_release_assets_release_id_idx on public.software_release_assets (release_id);

alter table public.software_releases enable row level security;
alter table public.software_release_assets enable row level security;

create policy "software_releases_public_read_published_or_admin"
  on public.software_releases
  for select
  using (is_published = true or public.is_admin());

create policy "software_releases_admin_insert"
  on public.software_releases
  for insert
  with check (public.is_admin());

create policy "software_releases_admin_update"
  on public.software_releases
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "software_releases_admin_delete"
  on public.software_releases
  for delete
  using (public.is_admin());

create policy "software_release_assets_public_read_published_or_admin"
  on public.software_release_assets
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.software_releases
      where software_releases.id = software_release_assets.release_id
        and software_releases.is_published = true
    )
  );

create policy "software_release_assets_admin_insert"
  on public.software_release_assets
  for insert
  with check (public.is_admin());

create policy "software_release_assets_admin_update"
  on public.software_release_assets
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "software_release_assets_admin_delete"
  on public.software_release_assets
  for delete
  using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('software-releases', 'software-releases', true)
on conflict (id) do update set public = true;

create policy "software_release_files_public_read"
  on storage.objects
  for select
  using (bucket_id = 'software-releases');

create policy "software_release_files_admin_insert"
  on storage.objects
  for insert
  with check (bucket_id = 'software-releases' and public.is_admin());

create policy "software_release_files_admin_update"
  on storage.objects
  for update
  using (bucket_id = 'software-releases' and public.is_admin())
  with check (bucket_id = 'software-releases' and public.is_admin());

create policy "software_release_files_admin_delete"
  on storage.objects
  for delete
  using (bucket_id = 'software-releases' and public.is_admin());
