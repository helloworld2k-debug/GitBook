alter table public.donation_tiers
  add column if not exists compare_at_amount integer;

alter table public.donation_tiers
  drop constraint if exists donation_tiers_compare_at_amount_check;

alter table public.donation_tiers
  add constraint donation_tiers_compare_at_amount_check
  check (compare_at_amount is null or compare_at_amount > amount);

update public.donation_tiers
set
  amount = 900,
  compare_at_amount = null,
  updated_at = now()
where code = 'monthly';

update public.donation_tiers
set
  amount = 2430,
  compare_at_amount = 2700,
  updated_at = now()
where code = 'quarterly';

update public.donation_tiers
set
  amount = 8640,
  compare_at_amount = 10800,
  updated_at = now()
where code = 'yearly';
