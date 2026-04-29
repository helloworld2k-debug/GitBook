create or replace function public.allocate_certificate_number(input_type certificate_type)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_value bigint;
  prefix text;
begin
  if input_type = 'donation' then
    seq_value := nextval('public.donation_certificate_seq');
    prefix := 'D';
  elsif input_type = 'honor' then
    seq_value := nextval('public.honor_certificate_seq');
    prefix := 'H';
  else
    raise exception 'Unsupported certificate type %', input_type;
  end if;

  return 'TFD-' || extract(year from now())::int || '-' || prefix || '-' || lpad(seq_value::text, 6, '0');
end;
$$;

revoke execute on function public.allocate_certificate_number(certificate_type) from anon, authenticated, public;
grant execute on function public.allocate_certificate_number(certificate_type) to service_role;

create or replace function public.get_paid_total(input_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.donations
  where user_id = input_user_id and status = 'paid' and currency = 'usd';
$$;

revoke execute on function public.get_paid_total(uuid) from anon, authenticated, public;
grant execute on function public.get_paid_total(uuid) to service_role;
