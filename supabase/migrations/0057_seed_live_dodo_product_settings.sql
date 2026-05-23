insert into public.payment_product_settings (
  provider,
  environment,
  tier_code,
  product_id,
  is_enabled,
  updated_at
)
values
  ('dodo', 'live', 'monthly', 'pdt_0NfSHqPkQZGNWArp4uJAF', true, now()),
  ('dodo', 'live', 'quarterly', 'pdt_0NfSHxjFX1RpH7lW8fk6k', true, now()),
  ('dodo', 'live', 'yearly', 'pdt_0NfSI4XGVWDVQ4Kt08DEz', true, now())
on conflict (provider, environment, tier_code)
do update set
  product_id = excluded.product_id,
  is_enabled = excluded.is_enabled,
  updated_at = excluded.updated_at;
