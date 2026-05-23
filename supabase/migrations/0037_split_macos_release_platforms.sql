alter type software_release_platform add value if not exists 'macos_arm64';
alter type software_release_platform add value if not exists 'macos_x64';

alter table public.software_releases
  add column if not exists macos_arm64_primary_url text,
  add column if not exists macos_arm64_backup_url text,
  add column if not exists macos_x64_primary_url text,
  add column if not exists macos_x64_backup_url text;
