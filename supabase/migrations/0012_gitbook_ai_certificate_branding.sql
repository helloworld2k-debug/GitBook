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

  return 'GBAI-' || extract(year from now())::int || '-' || prefix || '-' || lpad(seq_value::text, 6, '0');
end;
$$;

revoke execute on function public.allocate_certificate_number(certificate_type) from anon, authenticated, public;
grant execute on function public.allocate_certificate_number(certificate_type) to service_role;

update public.certificates
set certificate_number = regexp_replace(certificate_number, '^TFD-', 'GBAI-')
where certificate_number like 'TFD-%';
