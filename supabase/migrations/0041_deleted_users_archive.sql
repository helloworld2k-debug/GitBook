-- User archive delete with recovery functionality
-- This creates a table to store archived users and a function to restore them

-- Create the archive table
create table if not exists public.deleted_users_archive (
  id uuid primary key default gen_random_uuid(),
  original_user_id uuid not null,
  email text not null,
  display_name text,
  avatar_url text,
  preferred_locale text,
  public_supporter_enabled boolean,
  public_display_name text,
  is_admin boolean,
  admin_role text,
  account_status text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  deleted_reason text,
  metadata jsonb default '{}'
);

-- Add constraint to prevent duplicate emails in archive
alter table public.deleted_users_archive
  drop constraint if exists deleted_users_archive_email_key;

alter table public.deleted_users_archive
  add constraint deleted_users_archive_email_key unique (email);

-- Create indexes for efficient queries
create index if not exists idx_deleted_users_archive_original_user_id
  on public.deleted_users_archive(original_user_id);
create index if not exists idx_deleted_users_archive_deleted_at
  on public.deleted_users_archive(deleted_at desc);
create index if not exists idx_deleted_users_archive_email
  on public.deleted_users_archive(email);

-- Update profiles table to add archived_deleted status
alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'disabled', 'deleted', 'archived_deleted'));

-- Enable RLS
alter table public.deleted_users_archive enable row level security;

-- Grant access
grant select on public.deleted_users_archive to authenticated;
grant all on public.deleted_users_archive to service_role;

-- Policies: only admins can read archived users
create policy "archived_users_admin_read"
  on public.deleted_users_archive for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- Create restore function
create or replace function public.restore_archived_user(
  input_archive_id uuid,
  input_restored_by uuid
)
returns table(ok boolean, reason text, restored_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_user public.deleted_users_archive%rowtype;
  existing_profile public.profiles%rowtype;
  restored_user_id uuid;
  auth_user_exists boolean;
begin
  -- Get archived record
  select * into archived_user
  from public.deleted_users_archive
  where id = input_archive_id
  for update;

  if not found then
    return query select false, 'archive_not_found'::text, null::uuid;
    return;
  end if;

  -- Check if email already exists
  select * into existing_profile
  from public.profiles
  where email = archived_user.email
  limit 1;

  if found then
    return query select false, 'email_already_exists'::text, null::uuid;
    return;
  end if;

  -- Check if auth.user still exists
  select exists(
    select 1 from auth.users where id = archived_user.original_user_id
  ) into auth_user_exists;

  if not auth_user_exists then
    return query select false, 'auth_user_missing'::text, null::uuid;
    return;
  end if;

  -- Restore profile data
  update public.profiles
  set
    email = archived_user.email,
    display_name = archived_user.display_name,
    avatar_url = archived_user.avatar_url,
    preferred_locale = archived_user.preferred_locale,
    public_supporter_enabled = archived_user.public_supporter_enabled,
    public_display_name = archived_user.public_display_name,
    is_admin = archived_user.is_admin,
    admin_role = archived_user.admin_role,
    account_status = coalesce(archived_user.account_status, 'active'),
    updated_at = now()
  where id = archived_user.original_user_id;

  -- If profile was cascade deleted, re-insert it
  if not found then
    insert into public.profiles (
      id, email, display_name, avatar_url, preferred_locale,
      public_supporter_enabled, public_display_name,
      is_admin, admin_role, account_status, created_at, updated_at
    ) values (
      archived_user.original_user_id,
      archived_user.email,
      archived_user.display_name,
      archived_user.avatar_url,
      archived_user.preferred_locale,
      archived_user.public_supporter_enabled,
      archived_user.public_display_name,
      archived_user.is_admin,
      archived_user.admin_role,
      coalesce(archived_user.account_status, 'active'),
      archived_user.created_at,
      now()
    );
  end if;

  restored_user_id := archived_user.original_user_id;

  -- Delete archive record
  delete from public.deleted_users_archive where id = input_archive_id;

  -- Log audit
  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    before,
    after,
    reason,
    created_at
  ) values (
    input_restored_by,
    'restore_archived_user',
    'profile',
    restored_user_id,
    jsonb_build_object('archived', true, 'original_status', archived_user.account_status),
    jsonb_build_object('restored', true, 'new_status', 'active'),
    'Restored from deleted_users_archive',
    now()
  );

  return query select true, 'restored'::text, restored_user_id;
end;
$$;

-- Grant execute permission
grant execute on function public.restore_archived_user(uuid, uuid) to service_role;

-- Function to permanently delete from archive (owner only)
create or replace function public.permanently_delete_archived_user(
  input_archive_id uuid,
  input_deleted_by uuid
)
returns table(ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_user public.deleted_users_archive%rowtype;
  admin_user public.profiles%rowtype;
begin
  -- Get admin user to verify owner permission
  select * into admin_user
  from public.profiles
  where id = input_deleted_by;

  if not found or admin_user.admin_role != 'owner' then
    return query select false, 'insufficient_permissions'::text;
    return;
  end if;

  -- Get archived record
  select * into archived_user
  from public.deleted_users_archive
  where id = input_archive_id;

  if not found then
    return query select false, 'archive_not_found'::text;
    return;
  end if;

  -- Delete from auth.users (this will cascade to profiles if profile still exists)
  -- Using service_role to bypass RLS
  perform auth.uid(); -- Check auth context

  -- Log before deletion
  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    before,
    after,
    reason,
    created_at
  ) values (
    input_deleted_by,
    'permanently_delete_archived_user',
    'profile',
    archived_user.original_user_id,
    jsonb_build_object(
      'email', archived_user.email,
      'display_name', archived_user.display_name,
      'archived_at', archived_user.deleted_at
    ),
    jsonb_build_object('permanently_deleted', true),
    coalesce(archived_user.deleted_reason, 'Permanent deletion from archive'),
    now()
  );

  -- Delete the archive record
  delete from public.deleted_users_archive where id = input_archive_id;

  return query select true, 'deleted'::text;
end;
$$;

grant execute on function public.permanently_delete_archived_user(uuid, uuid) to service_role;
