insert into public.payment_product_settings (
  provider,
  environment,
  tier_code,
  product_id,
  is_enabled,
  updated_at
)
values
  ('dodo', 'test', 'monthly', 'pdt_0Ne1tWOH7HdGEH1kyyAKx', true, now()),
  ('dodo', 'test', 'quarterly', 'pdt_0Ne1tebquro8ZGf0Chqjv', true, now()),
  ('dodo', 'test', 'yearly', 'pdt_0Ne1tm1B9YujqPv0e9QOI', true, now())
on conflict (provider, environment, tier_code)
do update set
  product_id = excluded.product_id,
  is_enabled = excluded.is_enabled,
  updated_at = excluded.updated_at;
