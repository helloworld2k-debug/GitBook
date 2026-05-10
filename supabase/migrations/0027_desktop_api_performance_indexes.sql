create index if not exists desktop_sessions_token_active_idx
on public.desktop_sessions (token_hash)
where revoked_at is null;

create index if not exists license_entitlements_user_feature_status_idx
on public.license_entitlements (user_id, feature_code, status);

create index if not exists machine_trial_claims_user_machine_feature_idx
on public.machine_trial_claims (user_id, machine_code_hash, feature_code);

create index if not exists cloud_sync_leases_active_user_machine_idx
on public.cloud_sync_leases (user_id, machine_code_hash, created_at desc)
where revoked_at is null;

create index if not exists cloud_sync_leases_cooldown_user_machine_idx
on public.cloud_sync_leases (user_id, machine_code_hash, cooldown_until desc)
where revoked_at is not null and cooldown_until is not null;
