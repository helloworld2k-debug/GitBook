create or replace function public.get_admin_auth_user_status(input_user_ids uuid[])
returns table(
  user_id uuid,
  email text,
  has_password boolean,
  invited_at timestamptz,
  email_confirmed_at timestamptz,
  confirmed_at timestamptz,
  recovery_sent_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz,
  identity_providers text[]
)
language sql
security definer
set search_path = public, auth
as $$
  select
    auth_user.id as user_id,
    auth_user.email,
    coalesce(length(auth_user.encrypted_password) > 0, false) as has_password,
    auth_user.invited_at,
    auth_user.email_confirmed_at,
    auth_user.confirmed_at,
    auth_user.recovery_sent_at,
    auth_user.last_sign_in_at,
    auth_user.banned_until,
    auth_user.deleted_at,
    coalesce(
      array_agg(identity.provider order by identity.provider) filter (where identity.provider is not null),
      '{}'::text[]
    ) as identity_providers
  from auth.users auth_user
  left join auth.identities identity
    on identity.user_id = auth_user.id
  where auth_user.id = any(input_user_ids)
    and (
      auth.role() = 'service_role'
      or exists (
        select 1
        from public.profiles admin_profile
        where admin_profile.id = auth.uid()
          and admin_profile.account_status = 'active'
          and (
            admin_profile.is_admin = true
            or admin_profile.admin_role in ('owner', 'operator')
          )
      )
    )
  group by
    auth_user.id,
    auth_user.email,
    auth_user.encrypted_password,
    auth_user.invited_at,
    auth_user.email_confirmed_at,
    auth_user.confirmed_at,
    auth_user.recovery_sent_at,
    auth_user.last_sign_in_at,
    auth_user.banned_until,
    auth_user.deleted_at;
$$;

revoke all on function public.get_admin_auth_user_status(uuid[]) from public;
grant execute on function public.get_admin_auth_user_status(uuid[]) to service_role;
grant execute on function public.get_admin_auth_user_status(uuid[]) to authenticated;
