alter table public.profiles
  add column if not exists account_type text not null default 'standard';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('standard', 'ai_test'));

update public.profiles profile
set account_type = 'ai_test',
    updated_at = now()
from auth.users auth_users
where profile.id = auth_users.id
  and (
    auth_users.raw_user_meta_data->>'source' = 'codex-online-regression'
    or auth_users.email ilike 'codex-full-%@example.test'
  );

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_display_name text;
  normalized_public_display_name text;
  requested_locale text;
  resolved_account_type text;
begin
  requested_locale := new.raw_user_meta_data->>'preferred_locale';
  resolved_account_type := case
    when new.raw_user_meta_data->>'source' = 'codex-online-regression' then 'ai_test'
    when coalesce(new.email, new.raw_user_meta_data->>'email', '') ilike 'codex-full-%@example.test' then 'ai_test'
    else 'standard'
  end;
  normalized_display_name := left(nullif(btrim(coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  )), ''), 120);
  normalized_public_display_name := left(nullif(btrim(coalesce(
    new.raw_user_meta_data->>'public_display_name',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  )), ''), 80);

  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    preferred_locale,
    public_display_name,
    is_admin,
    email_verified,
    account_type
  )
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    normalized_display_name,
    nullif(btrim(new.raw_user_meta_data->>'avatar_url'), ''),
    case
      when requested_locale in ('en', 'zh-Hant', 'ja', 'ko') then requested_locale
      else 'en'
    end,
    normalized_public_display_name,
    false,
    new.email_confirmed_at is not null,
    resolved_account_type
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    public_display_name = coalesce(public.profiles.public_display_name, excluded.public_display_name),
    email_verified = public.profiles.email_verified or excluded.email_verified,
    account_type = case
      when excluded.account_type = 'ai_test' then 'ai_test'
      else public.profiles.account_type
    end,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.get_admin_users_paginated(
  input_page int default 1,
  input_per_page int default 20,
  input_search text default null,
  input_role_filter text default null,
  input_status_filter text default null,
  input_type_filter text default null,
  input_created_from timestamptz default null,
  input_created_to timestamptz default null,
  input_sort_column text default 'created_at',
  input_sort_direction text default 'desc'
)
returns table(
  users jsonb,
  total_count bigint,
  filtered_count bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_offset int;
  v_limit int;
  v_sort_sql text;
  v_where_sql text default '';
  v_search_sql text default '';
  v_final_where text default '';
begin
  v_offset := (greatest(input_page, 1) - 1) * greatest(input_per_page, 1);
  v_limit := greatest(input_per_page, 1);

  v_sort_sql := case input_sort_column
    when 'email' then 'p.email'
    when 'display_name' then 'p.display_name'
    when 'role' then 'p.admin_role'
    when 'status' then 'p.account_status'
    when 'type' then 'p.account_type'
    when 'created_at' then 'p.created_at'
    else 'p.created_at'
  end || ' ' || case input_sort_direction
    when 'asc' then 'asc'
    when 'desc' then 'desc'
    else 'desc'
  end;

  if input_search is not null and trim(input_search) != '' then
    v_search_sql := format(
      ' and (p.email ilike %L or p.display_name ilike %L or p.id::text ilike %L) ',
      '%' || trim(input_search) || '%',
      '%' || trim(input_search) || '%',
      '%' || trim(input_search) || '%'
    );
  end if;

  if input_role_filter is not null then
    v_where_sql := v_where_sql || format(' and (p.admin_role = %L or (p.admin_role is null and p.is_admin = true and %L = ''owner'')) ', input_role_filter, input_role_filter);
  end if;

  if input_status_filter is not null then
    v_where_sql := v_where_sql || format(' and p.account_status = %L ', input_status_filter);
  end if;

  if input_type_filter in ('standard', 'ai_test') then
    v_where_sql := v_where_sql || format(' and p.account_type = %L ', input_type_filter);
  elsif input_type_filter = 'admin' then
    v_where_sql := v_where_sql || ' and p.is_admin = true ';
  end if;

  if input_created_from is not null then
    v_where_sql := v_where_sql || format(' and p.created_at >= %L ', input_created_from);
  end if;
  if input_created_to is not null then
    v_where_sql := v_where_sql || format(' and p.created_at <= %L ', input_created_to);
  end if;

  v_where_sql := v_where_sql || ' and p.account_status != ''archived_deleted'' ';
  v_final_where := v_search_sql || v_where_sql;

  execute format(
    'select count(*) from public.profiles p where 1=1 %s',
    v_final_where
  ) into strict filtered_count;

  select count(*) into strict total_count
  from public.profiles
  where account_status != 'archived_deleted';

  return query execute format(
    $q$
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'email', p.email,
              'display_name', p.display_name,
              'admin_role', p.admin_role,
              'account_status', p.account_status,
              'account_type', p.account_type,
              'is_admin', p.is_admin,
              'avatar_url', p.avatar_url,
              'created_at', p.created_at
            )
          ),
          '[]'::jsonb
        ) as users,
        %s::bigint as total_count,
        %s::bigint as filtered_count
      from (
        select p.id, p.email, p.display_name, p.admin_role, p.account_status, p.account_type, p.is_admin, p.avatar_url, p.created_at
        from public.profiles p
        where 1=1 %s
        order by %s
        limit %s offset %s
      ) p
    $q$,
    total_count, filtered_count, v_final_where, v_sort_sql, v_limit, v_offset
  );
end;
$$;

revoke all on function public.get_admin_users_paginated(int, int, text, text, text, text, timestamptz, timestamptz, text, text) from public;
revoke all on function public.get_admin_users_paginated(int, int, text, text, text, text, timestamptz, timestamptz, text, text) from anon;
revoke all on function public.get_admin_users_paginated(int, int, text, text, text, text, timestamptz, timestamptz, text, text) from authenticated;
grant execute on function public.get_admin_users_paginated(int, int, text, text, text, text, timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.get_admin_users_paginated(int, int, text, text, text, text, timestamptz, timestamptz, text, text) to authenticated;
