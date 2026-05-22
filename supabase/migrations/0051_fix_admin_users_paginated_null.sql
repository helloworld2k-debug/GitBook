-- Fix: get_admin_users_paginated returns NULL for users when empty
-- Ensure jsonb_agg always returns an array, not NULL

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
  -- Validate pagination params
  v_offset := (input_page - 1) * input_per_page;
  v_limit := input_per_page;

  -- Build sort clause with validation
  v_sort_sql := case input_sort_column
    when 'email' then 'p.email'
    when 'display_name' then 'p.display_name'
    when 'role' then 'p.admin_role'
    when 'status' then 'p.account_status'
    when 'created_at' then 'p.created_at'
    else 'p.created_at'
  end || ' ' || case input_sort_direction
    when 'asc' then 'asc'
    when 'desc' then 'desc'
    else 'desc'
  end;

  -- Build search filter
  if input_search is not null and trim(input_search) != '' then
    v_search_sql := format(
      'and (p.email ilike %L or p.display_name ilike %L or p.id::text ilike %L)',
      '%' || trim(input_search) || '%',
      '%' || trim(input_search) || '%',
      '%' || trim(input_search) || '%'
    );
  end if;

  -- Build role filter
  if input_role_filter is not null then
    v_where_sql := v_where_sql || format(' and (p.admin_role = %L or (p.admin_role is null and p.is_admin = %L and %L = ''owner'')) ', input_role_filter, input_role_filter, input_role_filter);
  end if;

  -- Build status filter
  if input_status_filter is not null then
    v_where_sql := v_where_sql || format('and p.account_status = %L ', input_status_filter);
  end if;

  -- Build type filter
  if input_type_filter = 'admin' then
    v_where_sql := v_where_sql || 'and p.is_admin = true ';
  elsif input_type_filter = 'standard' then
    v_where_sql := v_where_sql || 'and (p.is_admin is null or p.is_admin = false) ';
  end if;

  -- Build date range filter
  if input_created_from is not null then
    v_where_sql := v_where_sql || format('and p.created_at >= %L ', input_created_from);
  end if;
  if input_created_to is not null then
    v_where_sql := v_where_sql || format('and p.created_at <= %L ', input_created_to);
  end if;

  -- Exclude archived_deleted users
  v_where_sql := v_where_sql || ' and p.account_status != ''archived_deleted'' ';

  v_final_where := v_search_sql || v_where_sql;

  -- Get filtered count first
  execute format(
    'select count(*) from public.profiles p where 1=1 %s',
    v_final_where
  ) into strict filtered_count;

  -- Get total count
  select count(*) into strict total_count
  from public.profiles
  where account_status != 'archived_deleted';

  -- Get paginated users
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
              'is_admin', p.is_admin,
              'avatar_url', p.avatar_url,
              'created_at', p.created_at
            )
          ),
          '[]'::jsonb
        ) as users,
        %L as total_count,
        %L as filtered_count
      from (
        select p.id, p.email, p.display_name, p.admin_role, p.account_status, p.is_admin, p.avatar_url, p.created_at
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