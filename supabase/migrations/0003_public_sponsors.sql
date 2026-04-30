create or replace function public.get_public_sponsors()
returns table (
  public_sponsor_id text,
  display_name text,
  paid_donation_count integer,
  paid_total_amount integer,
  currency text,
  sponsor_level_code text
)
language sql
stable
security definer
set search_path = public
as $$
  with paid_supporters as (
    select
      profiles.id,
      nullif(btrim(profiles.public_display_name), '') as display_name,
      donations.currency,
      count(donations.id)::integer as paid_donation_count,
      coalesce(sum(donations.amount), 0)::integer as paid_total_amount
    from public.profiles
    join public.donations
      on donations.user_id = profiles.id
    where profiles.public_supporter_enabled = true
      and donations.status = 'paid'
      and donations.currency = 'usd'
    group by profiles.id, profiles.public_display_name, donations.currency
  )
  select
    md5(paid_supporters.id::text) as public_sponsor_id,
    paid_supporters.display_name,
    paid_supporters.paid_donation_count,
    paid_supporters.paid_total_amount,
    paid_supporters.currency,
    sponsor_level.code as sponsor_level_code
  from paid_supporters
  left join lateral (
    select sponsor_levels.code
    from public.sponsor_levels
    where sponsor_levels.is_active = true
      and sponsor_levels.currency = paid_supporters.currency
      and sponsor_levels.minimum_total_amount <= paid_supporters.paid_total_amount
    order by sponsor_levels.minimum_total_amount desc
    limit 1
  ) sponsor_level on true
  order by paid_supporters.paid_total_amount desc, paid_supporters.paid_donation_count desc;
$$;

revoke execute on function public.get_public_sponsors() from public;
grant execute on function public.get_public_sponsors() to anon, authenticated;
