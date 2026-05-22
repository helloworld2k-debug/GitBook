-- Backfill cloud sync entitlements for historical paid Dodo donations.
-- The grant RPC is idempotent per source donation, so this migration is safe to rerun.

do $$
declare
  donation_row record;
  entitlement_months integer;
begin
  for donation_row in
    select id, user_id, paid_at, created_at, metadata
    from public.donations paid_donation
    where paid_donation.provider = 'dodo'
      and paid_donation.status = 'paid'
      and paid_donation.metadata->>'tier' in ('monthly', 'quarterly', 'yearly')
  loop
    entitlement_months := case donation_row.metadata->>'tier'
      when 'monthly' then 1
      when 'quarterly' then 3
      when 'yearly' then 12
      else null
    end;

    if entitlement_months is not null then
      perform public.grant_cloud_sync_entitlement_for_donation(
        input_user_id => donation_row.user_id,
        input_donation_id => donation_row.id,
        input_months => entitlement_months,
        input_paid_at => coalesce(donation_row.paid_at, donation_row.created_at)
      );
    end if;
  end loop;
end;
$$;
