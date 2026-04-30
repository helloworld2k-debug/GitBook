create or replace function public.create_manual_paid_donation_with_audit(
  input_admin_user_id uuid,
  input_user_id uuid,
  input_amount integer,
  input_currency text,
  input_provider_transaction_id text,
  input_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_donation public.donations;
begin
  if input_amount <= 0 then
    raise exception 'Manual donation amount must be positive';
  end if;

  if char_length(btrim(input_reason)) = 0 or char_length(input_reason) > 500 then
    raise exception 'Manual donation reason is required and must be 500 characters or fewer';
  end if;

  insert into public.donations (
    user_id,
    amount,
    currency,
    provider,
    provider_transaction_id,
    status,
    paid_at,
    metadata
  )
  values (
    input_user_id,
    input_amount,
    lower(input_currency),
    'manual',
    input_provider_transaction_id,
    'paid',
    now(),
    jsonb_build_object(
      'source', 'admin_manual_entry',
      'reason', btrim(input_reason),
      'admin_user_id', input_admin_user_id
    )
  )
  returning * into inserted_donation;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    before,
    after,
    reason
  )
  values (
    input_admin_user_id,
    'add_manual_donation',
    'donation',
    inserted_donation.id,
    null,
    to_jsonb(inserted_donation),
    btrim(input_reason)
  );

  return inserted_donation.id;
exception
  when unique_violation then
    select *
    into inserted_donation
    from public.donations
    where user_id = input_user_id
      and amount = input_amount
      and currency = lower(input_currency)
      and provider = 'manual'
      and provider_transaction_id = input_provider_transaction_id
      and status = 'paid'
      and metadata->>'reason' = btrim(input_reason)
      and metadata->>'admin_user_id' = input_admin_user_id::text;

    if inserted_donation.id is null then
      raise exception 'Manual donation reference already exists';
    end if;

    return inserted_donation.id;
end;
$$;

create or replace function public.revoke_certificate_with_audit(
  input_admin_user_id uuid,
  input_certificate_id uuid,
  input_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  before_certificate public.certificates;
  after_certificate public.certificates;
begin
  if char_length(btrim(input_reason)) = 0 or char_length(input_reason) > 500 then
    raise exception 'Certificate revoke reason is required and must be 500 characters or fewer';
  end if;

  select *
  into before_certificate
  from public.certificates
  where id = input_certificate_id
    and status = 'active'
  for update;

  if before_certificate.id is null then
    raise exception 'Active certificate not found';
  end if;

  update public.certificates
  set
    status = 'revoked',
    revoked_at = now(),
    updated_at = now()
  where id = input_certificate_id
    and status = 'active'
  returning * into after_certificate;

  if after_certificate.id is null then
    raise exception 'Unable to revoke active certificate';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    before,
    after,
    reason
  )
  values (
    input_admin_user_id,
    'revoke_certificate',
    'certificate',
    input_certificate_id,
    to_jsonb(before_certificate),
    to_jsonb(after_certificate),
    btrim(input_reason)
  );

  return after_certificate.id;
end;
$$;

revoke execute on function public.create_manual_paid_donation_with_audit(uuid, uuid, integer, text, text, text) from public;
revoke execute on function public.revoke_certificate_with_audit(uuid, uuid, text) from public;
grant execute on function public.create_manual_paid_donation_with_audit(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.revoke_certificate_with_audit(uuid, uuid, text) to service_role;
