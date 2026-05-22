-- Webhook event logging for debugging payment webhooks
create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text,
  status text not null check (status in ('received', 'processing', 'success', 'error')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Index for faster queries
create index if not exists webhook_logs_source_idx on public.webhook_logs(source);
create index if not exists webhook_logs_created_at_idx on public.webhook_logs(created_at desc);
create index if not exists webhook_logs_event_type_idx on public.webhook_logs(event_type);
create index if not exists webhook_logs_status_idx on public.webhook_logs(status);

-- Clean up old logs (keep last 90 days)
create function if not exists public.cleanup_old_webhook_logs()
returns int
language plpgsql
security definer
as $$
begin
  delete from public.webhook_logs where created_at < now() - interval '90 days';
  return found;
end;
$$;