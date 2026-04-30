# Desktop License Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build website-controlled desktop licensing for GitBook AI cloud sync, including paid entitlement stacking, admin-managed trial codes, machine-code trial enforcement, browser desktop login, one-active-device cloud sync leases, and admin visibility.

**Architecture:** The website is the sole license authority. Desktop apps authenticate through browser login, exchange a one-time code for a desktop session token, and call website APIs for license status and cloud sync lease ownership. Supabase stores donations, entitlements, trial code redemption, desktop sessions, device records, and lease state.

**Tech Stack:** Next.js App Router, React Server Components, Server Actions, Supabase Auth/Postgres/Storage, Stripe webhooks, Vitest, Playwright, TypeScript.

---

## File Structure

Create these focused units:

- `supabase/migrations/0007_desktop_license.sql`: license tables, indexes, and RLS policies.
- `src/lib/license/constants.ts`: feature codes, entitlement day mapping, token expiry constants.
- `src/lib/license/hash.ts`: salted SHA-256 helpers for trial codes, machine codes, auth codes, and desktop tokens.
- `src/lib/license/tokens.ts`: random code/token generation.
- `src/lib/license/entitlements.ts`: paid entitlement stacking and status lookup.
- `src/lib/license/trial-codes.ts`: admin trial code creation/editing and user redemption.
- `src/lib/license/desktop-auth.ts`: desktop auth code creation and exchange.
- `src/lib/license/desktop-session.ts`: desktop token validation and device/session touch.
- `src/lib/license/cloud-sync-leases.ts`: activate, heartbeat, and release logic.
- `src/lib/license/status.ts`: combines paid entitlement, trial claim, and lease status into one response.
- `src/app/api/desktop/auth/exchange/route.ts`: desktop code exchange endpoint.
- `src/app/api/license/status/route.ts`: cloud sync license status endpoint.
- `src/app/api/license/cloud-sync/activate/route.ts`: take over cloud sync lease.
- `src/app/api/license/cloud-sync/heartbeat/route.ts`: keep or deny current lease.
- `src/app/api/license/cloud-sync/release/route.ts`: release current lease.
- `src/app/[locale]/desktop/authorize/route.ts`: creates desktop auth code after website login and redirects back to the app custom protocol.
- `src/app/[locale]/dashboard/actions.ts`: add trial code redemption action.
- `src/app/[locale]/dashboard/page.tsx`: add trial redemption card.
- `src/app/[locale]/admin/actions.ts`: add trial code and license admin actions.
- `src/app/[locale]/admin/licenses/page.tsx`: admin license/trial/device page.
- `messages/*.json`: localized dashboard/admin/license copy.
- `src/lib/database.types.ts`: typed tables/enums for new schema.

Do not implement actual cloud sync data storage, native desktop UI, offline grace, or device login count limits in this plan.

---

## Task 1: Database Migration And Types

**Files:**
- Create: `supabase/migrations/0007_desktop_license.sql`
- Modify: `src/lib/database.types.ts`
- Test: `tests/unit/desktop-license-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

Create `tests/unit/desktop-license-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0007_desktop_license.sql"), "utf8");

describe("desktop license migration", () => {
  it("creates license, trial, desktop session, and cloud sync lease tables", () => {
    expect(migration).toContain("create type license_feature_code as enum ('cloud_sync')");
    expect(migration).toContain("create type license_entitlement_status as enum ('active', 'expired', 'revoked')");
    expect(migration).toContain("create table public.license_entitlements");
    expect(migration).toContain("create table public.trial_codes");
    expect(migration).toContain("create table public.trial_code_redemptions");
    expect(migration).toContain("create table public.machine_trial_claims");
    expect(migration).toContain("create table public.desktop_auth_codes");
    expect(migration).toContain("create table public.desktop_sessions");
    expect(migration).toContain("create table public.desktop_devices");
    expect(migration).toContain("create table public.cloud_sync_leases");
    expect(migration).toContain("unique (machine_code_hash, feature_code)");
    expect(migration).toContain("cloud_sync_leases_one_active_per_user");
  });

  it("keeps sensitive code and token fields hashed", () => {
    expect(migration).toContain("code_hash text not null");
    expect(migration).toContain("token_hash text not null");
    expect(migration).toContain("machine_code_hash text not null");
    expect(migration).not.toContain("raw_code");
    expect(migration).not.toContain("raw_token");
    expect(migration).not.toContain("machine_code text");
  });

  it("enables RLS and admin access policies", () => {
    expect(migration).toContain("alter table public.license_entitlements enable row level security");
    expect(migration).toContain("alter table public.trial_codes enable row level security");
    expect(migration).toContain("alter table public.desktop_sessions enable row level security");
    expect(migration).toContain("public.is_admin()");
    expect(migration).toContain("auth.uid()");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- --run tests/unit/desktop-license-migration.test.ts
```

Expected: FAIL because `supabase/migrations/0007_desktop_license.sql` does not exist.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/0007_desktop_license.sql`:

```sql
create type license_feature_code as enum ('cloud_sync');
create type license_entitlement_status as enum ('active', 'expired', 'revoked');

create table public.license_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_code license_feature_code not null default 'cloud_sync',
  valid_until timestamptz not null,
  status license_entitlement_status not null default 'active',
  source_donation_id uuid references public.donations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_code)
);

create table public.trial_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text not null,
  feature_code license_feature_code not null default 'cloud_sync',
  trial_days integer not null default 3 check (trial_days > 0 and trial_days <= 365),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.trial_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  trial_code_id uuid not null references public.trial_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  machine_code_hash text not null,
  feature_code license_feature_code not null default 'cloud_sync',
  redeemed_at timestamptz not null default now(),
  trial_valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (trial_code_id, user_id, feature_code)
);

create table public.machine_trial_claims (
  id uuid primary key default gen_random_uuid(),
  machine_code_hash text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trial_code_id uuid references public.trial_codes(id) on delete set null,
  feature_code license_feature_code not null default 'cloud_sync',
  trial_started_at timestamptz not null default now(),
  trial_valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (machine_code_hash, feature_code)
);

create table public.desktop_auth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_session_id text not null,
  return_url text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.desktop_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  machine_code_hash text not null,
  platform text not null,
  device_name text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create table public.desktop_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  device_id text not null,
  machine_code_hash text not null,
  platform text not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  cloud_sync_active_until timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cloud_sync_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  desktop_session_id uuid not null references public.desktop_sessions(id) on delete cascade,
  device_id text not null,
  machine_code_hash text not null,
  lease_started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cloud_sync_leases_one_active_per_user
on public.cloud_sync_leases (user_id)
where revoked_at is null;

create index license_entitlements_user_feature_idx on public.license_entitlements (user_id, feature_code);
create index machine_trial_claims_user_idx on public.machine_trial_claims (user_id);
create index trial_code_redemptions_user_idx on public.trial_code_redemptions (user_id);
create index desktop_sessions_token_hash_idx on public.desktop_sessions (token_hash);
create index desktop_sessions_user_idx on public.desktop_sessions (user_id);
create index desktop_devices_machine_idx on public.desktop_devices (machine_code_hash);
create index cloud_sync_leases_session_idx on public.cloud_sync_leases (desktop_session_id);

alter table public.license_entitlements enable row level security;
alter table public.trial_codes enable row level security;
alter table public.trial_code_redemptions enable row level security;
alter table public.machine_trial_claims enable row level security;
alter table public.desktop_auth_codes enable row level security;
alter table public.desktop_devices enable row level security;
alter table public.desktop_sessions enable row level security;
alter table public.cloud_sync_leases enable row level security;

create policy "license_entitlements_select_own_or_admin"
  on public.license_entitlements for select
  using (user_id = auth.uid() or public.is_admin());

create policy "trial_codes_admin_all"
  on public.trial_codes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "trial_redemptions_select_own_or_admin"
  on public.trial_code_redemptions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "machine_trial_claims_select_own_or_admin"
  on public.machine_trial_claims for select
  using (user_id = auth.uid() or public.is_admin());

create policy "desktop_auth_codes_select_own_or_admin"
  on public.desktop_auth_codes for select
  using (user_id = auth.uid() or public.is_admin());

create policy "desktop_devices_select_own_or_admin"
  on public.desktop_devices for select
  using (user_id = auth.uid() or public.is_admin());

create policy "desktop_sessions_select_own_or_admin"
  on public.desktop_sessions for select
  using (user_id = auth.uid() or public.is_admin());

create policy "cloud_sync_leases_select_own_or_admin"
  on public.cloud_sync_leases for select
  using (user_id = auth.uid() or public.is_admin());
```

- [ ] **Step 4: Update `src/lib/database.types.ts`**

Add new enums and tables to the existing `Database["public"]` type. Use these exact enum names:

```ts
license_entitlement_status: "active" | "expired" | "revoked";
license_feature_code: "cloud_sync";
```

Add table definitions for:

- `license_entitlements`
- `trial_codes`
- `trial_code_redemptions`
- `machine_trial_claims`
- `desktop_auth_codes`
- `desktop_devices`
- `desktop_sessions`
- `cloud_sync_leases`

Each table should include `Row`, `Insert`, `Update`, and `Relationships` sections matching the migration. Keep `Json`, existing tables, and existing function types unchanged.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- --run tests/unit/desktop-license-migration.test.ts
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_desktop_license.sql src/lib/database.types.ts tests/unit/desktop-license-migration.test.ts
git commit -m "Add desktop license database schema"
```

---

## Task 2: License Constants, Hashing, And Tokens

**Files:**
- Create: `src/lib/license/constants.ts`
- Create: `src/lib/license/hash.ts`
- Create: `src/lib/license/tokens.ts`
- Test: `tests/unit/license-crypto.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/license-crypto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLOUD_SYNC_FEATURE, DESKTOP_AUTH_CODE_TTL_SECONDS, DESKTOP_SESSION_TTL_DAYS, getEntitlementDaysForTier } from "@/lib/license/constants";
import { hashDesktopSecret, normalizeMachineCode } from "@/lib/license/hash";
import { generateDesktopSecret } from "@/lib/license/tokens";

describe("license constants", () => {
  it("maps donation tiers to entitlement days", () => {
    expect(getEntitlementDaysForTier("monthly")).toBe(30);
    expect(getEntitlementDaysForTier("quarterly")).toBe(90);
    expect(getEntitlementDaysForTier("yearly")).toBe(365);
    expect(getEntitlementDaysForTier("unknown")).toBeNull();
  });

  it("uses cloud sync as the first feature code", () => {
    expect(CLOUD_SYNC_FEATURE).toBe("cloud_sync");
    expect(DESKTOP_AUTH_CODE_TTL_SECONDS).toBe(300);
    expect(DESKTOP_SESSION_TTL_DAYS).toBe(30);
  });
});

describe("license hashing", () => {
  it("normalizes machine codes before hashing", async () => {
    expect(normalizeMachineCode("  ABC-def  ")).toBe("abc-def");
  });

  it("hashes secrets deterministically without returning raw values", async () => {
    const hashA = await hashDesktopSecret("ABC-def", "machine");
    const hashB = await hashDesktopSecret("abc-def", "machine");

    expect(hashA).toBe(hashB);
    expect(hashA).not.toContain("ABC");
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("desktop token generation", () => {
  it("generates URL-safe secrets", () => {
    const token = generateDesktopSecret();

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/unit/license-crypto.test.ts
```

Expected: FAIL because `src/lib/license/*` files do not exist.

- [ ] **Step 3: Create constants**

Create `src/lib/license/constants.ts`:

```ts
export const CLOUD_SYNC_FEATURE = "cloud_sync" as const;
export const DESKTOP_AUTH_CODE_TTL_SECONDS = 5 * 60;
export const DESKTOP_SESSION_TTL_DAYS = 30;
export const CLOUD_SYNC_LEASE_TTL_SECONDS = 120;

const entitlementDaysByTier: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export function getEntitlementDaysForTier(tierCode: string | null | undefined) {
  if (!tierCode) {
    return null;
  }

  return entitlementDaysByTier[tierCode] ?? null;
}
```

- [ ] **Step 4: Create hashing helpers**

Create `src/lib/license/hash.ts`:

```ts
import { createHash } from "node:crypto";

const HASH_SALT = process.env.LICENSE_HASH_SALT || "gitbook-ai-development-license-salt";

export function normalizeMachineCode(value: string) {
  return value.trim().toLowerCase();
}

export async function hashDesktopSecret(value: string, purpose: "auth_code" | "desktop_token" | "machine" | "trial_code") {
  const normalized = purpose === "machine" ? normalizeMachineCode(value) : value.trim();

  return createHash("sha256").update(`${purpose}:${HASH_SALT}:${normalized}`).digest("hex");
}
```

- [ ] **Step 5: Create token helper**

Create `src/lib/license/tokens.ts`:

```ts
import { randomBytes } from "node:crypto";

export function generateDesktopSecret(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --run tests/unit/license-crypto.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/license/constants.ts src/lib/license/hash.ts src/lib/license/tokens.ts tests/unit/license-crypto.test.ts
git commit -m "Add license crypto helpers"
```

---

## Task 3: Paid Entitlement Service

**Files:**
- Create: `src/lib/license/entitlements.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Modify: `src/app/[locale]/admin/actions.ts`
- Test: `tests/unit/license-entitlements.test.ts`
- Test: `tests/unit/stripe-webhook.test.ts`
- Test: `tests/unit/admin-actions.test.ts`

- [ ] **Step 1: Write failing entitlement service tests**

Create `tests/unit/license-entitlements.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { extendCloudSyncEntitlementForDonation, getCloudSyncEntitlementStatus } from "@/lib/license/entitlements";

function createEntitlementClient(currentValidUntil: string | null) {
  const maybeSingle = vi.fn(async () => ({
    data: currentValidUntil
      ? { id: "entitlement-1", valid_until: currentValidUntil, status: "active" }
      : null,
    error: null,
  }));
  const select = vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const upsertSelect = vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "entitlement-1" }, error: null })) }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));
  const from = vi.fn(() => ({ select, update, upsert }));

  return { from, maybeSingle, update, updateEq, upsert };
}

describe("extendCloudSyncEntitlementForDonation", () => {
  it("starts from paidAt when no current entitlement exists", async () => {
    const client = createEntitlementClient(null);

    await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-1",
      tierCode: "monthly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        feature_code: "cloud_sync",
        valid_until: "2026-05-31T00:00:00.000Z",
        source_donation_id: "donation-1",
        status: "active",
      }),
      { onConflict: "user_id,feature_code" },
    );
  });

  it("stacks from the current valid_until when entitlement is active", async () => {
    const client = createEntitlementClient("2026-05-21T00:00:00.000Z");

    await extendCloudSyncEntitlementForDonation(client, {
      userId: "user-1",
      donationId: "donation-2",
      tierCode: "yearly",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(client.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        valid_until: "2027-05-21T00:00:00.000Z",
      }),
      { onConflict: "user_id,feature_code" },
    );
  });

  it("rejects unknown tiers", async () => {
    const client = createEntitlementClient(null);

    await expect(
      extendCloudSyncEntitlementForDonation(client, {
        userId: "user-1",
        donationId: "donation-1",
        tierCode: "lifetime",
        paidAt: new Date("2026-05-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Unsupported entitlement tier");
  });
});

describe("getCloudSyncEntitlementStatus", () => {
  it("returns active when valid_until is in the future", async () => {
    const client = createEntitlementClient("2026-05-31T00:00:00.000Z");

    const status = await getCloudSyncEntitlementStatus(client, "user-1", new Date("2026-05-01T00:00:00.000Z"));

    expect(status).toEqual({
      allowed: true,
      reason: "active",
      source: "paid",
      validUntil: "2026-05-31T00:00:00.000Z",
      remainingDays: 30,
    });
  });

  it("returns expired when valid_until is in the past", async () => {
    const client = createEntitlementClient("2026-04-30T00:00:00.000Z");

    const status = await getCloudSyncEntitlementStatus(client, "user-1", new Date("2026-05-01T00:00:00.000Z"));

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe("expired");
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --run tests/unit/license-entitlements.test.ts
```

Expected: FAIL because `src/lib/license/entitlements.ts` does not exist.

- [ ] **Step 3: Implement entitlement service**

Create `src/lib/license/entitlements.ts`:

```ts
import { CLOUD_SYNC_FEATURE, getEntitlementDaysForTier } from "@/lib/license/constants";

type EntitlementClient = {
  from: (table: string) => any;
};

type ExtendInput = {
  userId: string;
  donationId: string;
  tierCode: string;
  paidAt: Date;
};

export type LicenseReason = "active" | "expired" | "no_entitlement" | "revoked";

export type EntitlementStatus = {
  allowed: boolean;
  reason: LicenseReason;
  source?: "paid";
  validUntil: string | null;
  remainingDays: number;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function remainingDaysUntil(validUntil: string, now: Date) {
  return Math.max(0, Math.ceil((new Date(validUntil).getTime() - now.getTime()) / 86_400_000));
}

export async function extendCloudSyncEntitlementForDonation(client: EntitlementClient, input: ExtendInput) {
  const days = getEntitlementDaysForTier(input.tierCode);

  if (!days) {
    throw new Error("Unsupported entitlement tier");
  }

  const { data: current, error: currentError } = await client
    .from("license_entitlements")
    .select("id,valid_until,status")
    .eq("user_id", input.userId)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (currentError) {
    throw new Error("Unable to read entitlement");
  }

  const currentValidUntil = current?.status === "active" && current.valid_until ? new Date(current.valid_until) : null;
  const start = currentValidUntil && currentValidUntil > input.paidAt ? currentValidUntil : input.paidAt;
  const validUntil = addDays(start, days).toISOString();

  const { error } = await client
    .from("license_entitlements")
    .upsert(
      {
        user_id: input.userId,
        feature_code: CLOUD_SYNC_FEATURE,
        valid_until: validUntil,
        status: "active",
        source_donation_id: input.donationId,
      },
      { onConflict: "user_id,feature_code" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error("Unable to extend entitlement");
  }

  return validUntil;
}

export async function getCloudSyncEntitlementStatus(
  client: EntitlementClient,
  userId: string,
  now = new Date(),
): Promise<EntitlementStatus> {
  const { data, error } = await client
    .from("license_entitlements")
    .select("valid_until,status")
    .eq("user_id", userId)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to read entitlement");
  }

  if (!data) {
    return { allowed: false, reason: "no_entitlement", validUntil: null, remainingDays: 0 };
  }

  if (data.status === "revoked") {
    return { allowed: false, reason: "revoked", validUntil: data.valid_until, remainingDays: 0 };
  }

  if (new Date(data.valid_until) <= now) {
    return { allowed: false, reason: "expired", validUntil: data.valid_until, remainingDays: 0 };
  }

  return {
    allowed: true,
    reason: "active",
    source: "paid",
    validUntil: data.valid_until,
    remainingDays: remainingDaysUntil(data.valid_until, now),
  };
}
```

- [ ] **Step 4: Integrate Stripe webhook**

Modify `src/app/api/webhooks/stripe/route.ts`:

```ts
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
```

After `await generateCertificatesForDonation(donation.id);`, add:

```ts
await extendCloudSyncEntitlementForDonation(supabase, {
  userId,
  donationId: donation.id,
  tierCode: donationTier.code,
  paidAt: new Date(session.created * 1000),
});
```

- [ ] **Step 5: Integrate manual donation action**

Modify `src/app/[locale]/admin/actions.ts`:

```ts
import { extendCloudSyncEntitlementForDonation } from "@/lib/license/entitlements";
```

After `await generateCertificatesForDonation(donationId);`, add:

```ts
await extendCloudSyncEntitlementForDonation(supabase, {
  userId: profile.id,
  donationId,
  tierCode: "yearly",
  paidAt: new Date(),
});
```

Use `yearly` for manual admin grants because the existing manual form captures amount but not tier code. A later UI refinement can add a tier selector.

- [ ] **Step 6: Update existing webhook/action tests**

In `tests/unit/stripe-webhook.test.ts`, mock `extendCloudSyncEntitlementForDonation` and assert it is called with the donation ID and tier.

In `tests/unit/admin-actions.test.ts`, mock `extendCloudSyncEntitlementForDonation` and assert manual donations extend the entitlement.

- [ ] **Step 7: Run tests**

```bash
npm test -- --run tests/unit/license-entitlements.test.ts tests/unit/stripe-webhook.test.ts tests/unit/admin-actions.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/license/entitlements.ts src/app/api/webhooks/stripe/route.ts src/app/[locale]/admin/actions.ts tests/unit/license-entitlements.test.ts tests/unit/stripe-webhook.test.ts tests/unit/admin-actions.test.ts
git commit -m "Extend cloud sync entitlement from donations"
```

---

## Task 4: Desktop Auth Code Creation And Exchange

**Files:**
- Create: `src/lib/license/desktop-auth.ts`
- Create: `src/app/[locale]/desktop/authorize/route.ts`
- Create: `src/app/api/desktop/auth/exchange/route.ts`
- Test: `tests/unit/desktop-auth.test.ts`
- Test: `tests/unit/desktop-auth-routes.test.ts`

- [ ] **Step 1: Write service tests**

Create `tests/unit/desktop-auth.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createDesktopAuthCode, exchangeDesktopAuthCode } from "@/lib/license/desktop-auth";

describe("desktop auth", () => {
  it("creates a single-use auth code record and returns the raw code once", async () => {
    const insertSingle = vi.fn(async () => ({ data: { id: "code-1" }, error: null }));
    const select = vi.fn(() => ({ single: insertSingle }));
    const insert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ insert })) };

    const result = await createDesktopAuthCode(client, {
      userId: "user-1",
      deviceSessionId: "desktop-flow-1",
      returnUrl: "gitbookai://auth/callback",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result.code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        device_session_id: "desktop-flow-1",
        return_url: "gitbookai://auth/callback",
        expires_at: "2026-05-01T00:05:00.000Z",
      }),
    );
  });

  it("exchanges a valid code for a desktop session token and records device metadata", async () => {
    const authCode = {
      id: "auth-code-1",
      user_id: "user-1",
      expires_at: "2026-05-01T00:05:00.000Z",
      used_at: null,
    };
    const authCodeSingle = vi.fn(async () => ({ data: authCode, error: null }));
    const sessionSingle = vi.fn(async () => ({ data: { id: "session-1" }, error: null }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const upsert = vi.fn(async () => ({ error: null }));
    const insertSelect = vi.fn(() => ({ single: sessionSingle }));
    const insert = vi.fn(() => ({ select: insertSelect }));
    const from = vi.fn((table: string) => {
      if (table === "desktop_auth_codes") {
        return {
          select: () => ({ eq: () => ({ single: authCodeSingle }) }),
          update: () => ({ eq: updateEq }),
        };
      }
      if (table === "desktop_devices") {
        return { upsert };
      }
      if (table === "desktop_sessions") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await exchangeDesktopAuthCode(
      { from },
      {
        code: "raw-code",
        deviceId: "device-a",
        machineCode: "MACHINE-A",
        platform: "macos",
        appVersion: "1.0.0",
        deviceName: "Studio Mac",
        now: new Date("2026-05-01T00:01:00.000Z"),
      },
    );

    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.userId).toBe("user-1");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        device_id: "device-a",
        platform: "macos",
        app_version: "1.0.0",
      }),
      { onConflict: "user_id,device_id" },
    );
    expect(updateEq).toHaveBeenCalledWith("id", "auth-code-1");
  });
});
```

- [ ] **Step 2: Run service tests to verify failure**

```bash
npm test -- --run tests/unit/desktop-auth.test.ts
```

Expected: FAIL because `src/lib/license/desktop-auth.ts` does not exist.

- [ ] **Step 3: Implement desktop auth service**

Create `src/lib/license/desktop-auth.ts` with these exported functions:

```ts
import { DESKTOP_AUTH_CODE_TTL_SECONDS, DESKTOP_SESSION_TTL_DAYS } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
import { generateDesktopSecret } from "@/lib/license/tokens";

type Client = { from: (table: string) => any };

type CreateInput = {
  userId: string;
  deviceSessionId: string;
  returnUrl: string;
  now?: Date;
};

type ExchangeInput = {
  code: string;
  deviceId: string;
  machineCode: string;
  platform: string;
  appVersion?: string | null;
  deviceName?: string | null;
  now?: Date;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function createDesktopAuthCode(client: Client, input: CreateInput) {
  const now = input.now ?? new Date();
  const code = generateDesktopSecret();
  const codeHash = await hashDesktopSecret(code, "auth_code");
  const expiresAt = addSeconds(now, DESKTOP_AUTH_CODE_TTL_SECONDS).toISOString();

  const { data, error } = await client
    .from("desktop_auth_codes")
    .insert({
      code_hash: codeHash,
      user_id: input.userId,
      device_session_id: input.deviceSessionId,
      return_url: input.returnUrl,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to create desktop auth code");
  }

  return { code, expiresAt };
}

export async function exchangeDesktopAuthCode(client: Client, input: ExchangeInput) {
  const now = input.now ?? new Date();
  const codeHash = await hashDesktopSecret(input.code, "auth_code");
  const machineCodeHash = await hashDesktopSecret(input.machineCode, "machine");
  const sessionToken = generateDesktopSecret();
  const tokenHash = await hashDesktopSecret(sessionToken, "desktop_token");
  const expiresAt = addDays(now, DESKTOP_SESSION_TTL_DAYS).toISOString();

  const { data: authCode, error: codeError } = await client
    .from("desktop_auth_codes")
    .select("id,user_id,expires_at,used_at")
    .eq("code_hash", codeHash)
    .single();

  if (codeError || !authCode || authCode.used_at || new Date(authCode.expires_at) <= now) {
    throw new Error("Invalid or expired desktop auth code");
  }

  const { error: deviceError } = await client.from("desktop_devices").upsert(
    {
      user_id: authCode.user_id,
      device_id: input.deviceId,
      machine_code_hash: machineCodeHash,
      platform: input.platform,
      app_version: input.appVersion ?? null,
      device_name: input.deviceName ?? null,
      last_seen_at: now.toISOString(),
    },
    { onConflict: "user_id,device_id" },
  );

  if (deviceError) {
    throw new Error("Unable to record desktop device");
  }

  const { data: session, error: sessionError } = await client
    .from("desktop_sessions")
    .insert({
      user_id: authCode.user_id,
      token_hash: tokenHash,
      device_id: input.deviceId,
      machine_code_hash: machineCodeHash,
      platform: input.platform,
      app_version: input.appVersion ?? null,
      last_seen_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error("Unable to create desktop session");
  }

  const { error: usedError } = await client
    .from("desktop_auth_codes")
    .update({ used_at: now.toISOString() })
    .eq("id", authCode.id);

  if (usedError) {
    throw new Error("Unable to mark desktop auth code as used");
  }

  return {
    sessionToken,
    expiresAt,
    userId: authCode.user_id,
    desktopSessionId: session.id,
  };
}
```

- [ ] **Step 4: Add desktop authorize route**

Create `src/app/[locale]/desktop/authorize/route.ts`:

```ts
import { NextResponse } from "next/server";
import { supportedLocales, type Locale } from "@/config/site";
import { createDesktopAuthCode } from "@/lib/license/desktop-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeReturnUrl(value: string | null) {
  if (!value || !value.startsWith("gitbookai://auth/callback")) {
    return null;
  }

  return value;
}

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 404 });
  }

  const url = new URL(request.url);
  const deviceSessionId = url.searchParams.get("device_session_id");
  const returnUrl = safeReturnUrl(url.searchParams.get("return_url"));

  if (!deviceSessionId || !returnUrl) {
    return NextResponse.json({ error: "Missing desktop authorization parameters" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/${locale}/desktop/authorize?device_session_id=${encodeURIComponent(deviceSessionId)}&return_url=${encodeURIComponent(returnUrl)}`;
    return NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(next)}`, request.url));
  }

  const { code } = await createDesktopAuthCode(supabase, {
    userId: user.id,
    deviceSessionId,
    returnUrl,
  });
  const callback = new URL(returnUrl);
  callback.searchParams.set("code", code);

  return NextResponse.redirect(callback);
}
```

- [ ] **Step 5: Add exchange API route**

Create `src/app/api/desktop/auth/exchange/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeDesktopAuthCode } from "@/lib/license/desktop-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  code: z.string().min(20),
  deviceId: z.string().min(4).max(200),
  machineCode: z.string().min(4).max(500),
  platform: z.string().min(2).max(80),
  appVersion: z.string().max(80).optional(),
  deviceName: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const parsed = exchangeSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid desktop auth exchange request" }, { status: 400 });
  }

  try {
    const result = await exchangeDesktopAuthCode(createSupabaseAdminClient(), parsed.data);

    return NextResponse.json({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      userId: result.userId,
      desktopSessionId: result.desktopSessionId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid or expired desktop auth code" }, { status: 401 });
  }
}
```

- [ ] **Step 6: Run tests and build**

```bash
npm test -- --run tests/unit/desktop-auth.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/license/desktop-auth.ts src/app/[locale]/desktop/authorize/route.ts src/app/api/desktop/auth/exchange/route.ts tests/unit/desktop-auth.test.ts
git commit -m "Add desktop browser login exchange"
```

---

## Task 5: Trial Code Redemption Service And Dashboard Form

**Files:**
- Create: `src/lib/license/trial-codes.ts`
- Modify: `src/app/[locale]/dashboard/actions.ts`
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh-Hant.json`
- Modify: `messages/ja.json`
- Modify: `messages/ko.json`
- Test: `tests/unit/trial-codes.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/unit/trial-codes.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { redeemTrialCode } from "@/lib/license/trial-codes";

function createTrialClient(input: {
  code?: {
    id: string;
    trial_days: number;
    starts_at: string;
    ends_at: string;
    max_redemptions: number | null;
    redemption_count: number;
    is_active: boolean;
  } | null;
  existingMachineClaim?: boolean;
  duplicateUserRedemption?: boolean;
}) {
  const codeSingle = vi.fn(async () => ({ data: input.code ?? null, error: input.code === undefined ? new Error("not found") : null }));
  const machineMaybeSingle = vi.fn(async () => ({
    data: input.existingMachineClaim ? { id: "claim-1" } : null,
    error: null,
  }));
  const redemptionMaybeSingle = vi.fn(async () => ({
    data: input.duplicateUserRedemption ? { id: "redemption-1" } : null,
    error: null,
  }));
  const insert = vi.fn(async () => ({ error: null }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn((table: string) => {
    if (table === "trial_codes") {
      return {
        select: () => ({ eq: () => ({ single: codeSingle }) }),
        update,
      };
    }
    if (table === "machine_trial_claims") {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: machineMaybeSingle }) }) }),
        insert,
      };
    }
    if (table === "trial_code_redemptions") {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: redemptionMaybeSingle }) }) }) }),
        insert,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from, insert, update };
}

describe("redeemTrialCode", () => {
  it("creates a 3-day machine trial claim for a valid code", async () => {
    const client = createTrialClient({
      code: {
        id: "code-1",
        trial_days: 3,
        starts_at: "2026-05-01T00:00:00.000Z",
        ends_at: "2026-06-01T00:00:00.000Z",
        max_redemptions: 100,
        redemption_count: 5,
        is_active: true,
      },
    });

    const result = await redeemTrialCode(client, {
      userId: "user-1",
      code: "SPRING-2026",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      validUntil: "2026-05-04T00:00:00.000Z",
    });
  });

  it("blocks reuse of a machine trial", async () => {
    const client = createTrialClient({
      existingMachineClaim: true,
      code: {
        id: "code-1",
        trial_days: 3,
        starts_at: "2026-05-01T00:00:00.000Z",
        ends_at: "2026-06-01T00:00:00.000Z",
        max_redemptions: null,
        redemption_count: 0,
        is_active: true,
      },
    });

    const result = await redeemTrialCode(client, {
      userId: "user-2",
      code: "SPRING-2026",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: false, reason: "machine_trial_used" });
  });

  it("blocks inactive codes", async () => {
    const client = createTrialClient({
      code: {
        id: "code-1",
        trial_days: 3,
        starts_at: "2026-05-01T00:00:00.000Z",
        ends_at: "2026-06-01T00:00:00.000Z",
        max_redemptions: null,
        redemption_count: 0,
        is_active: false,
      },
    });

    const result = await redeemTrialCode(client, {
      userId: "user-1",
      code: "SPRING-2026",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ ok: false, reason: "trial_code_inactive" });
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --run tests/unit/trial-codes.test.ts
```

Expected: FAIL because `src/lib/license/trial-codes.ts` does not exist.

- [ ] **Step 3: Implement trial redemption service**

Create `src/lib/license/trial-codes.ts`:

```ts
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";

type Client = { from: (table: string) => any };

type RedeemInput = {
  userId: string;
  code: string;
  machineCodeHash: string;
  now?: Date;
};

type TrialRedeemFailure =
  | "trial_code_invalid"
  | "trial_code_inactive"
  | "trial_code_limit_reached"
  | "machine_trial_used"
  | "duplicate_trial_code_user";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function redeemTrialCode(
  client: Client,
  input: RedeemInput,
): Promise<{ ok: true; validUntil: string } | { ok: false; reason: TrialRedeemFailure }> {
  const now = input.now ?? new Date();
  const codeHash = await hashDesktopSecret(input.code, "trial_code");
  const { data: trialCode } = await client
    .from("trial_codes")
    .select("id,trial_days,starts_at,ends_at,max_redemptions,redemption_count,is_active")
    .eq("code_hash", codeHash)
    .single();

  if (!trialCode) {
    return { ok: false, reason: "trial_code_invalid" };
  }

  if (!trialCode.is_active || new Date(trialCode.starts_at) > now || new Date(trialCode.ends_at) < now) {
    return { ok: false, reason: "trial_code_inactive" };
  }

  if (trialCode.max_redemptions !== null && trialCode.redemption_count >= trialCode.max_redemptions) {
    return { ok: false, reason: "trial_code_limit_reached" };
  }

  const { data: machineClaim } = await client
    .from("machine_trial_claims")
    .select("id")
    .eq("machine_code_hash", input.machineCodeHash)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (machineClaim) {
    return { ok: false, reason: "machine_trial_used" };
  }

  const { data: duplicateRedemption } = await client
    .from("trial_code_redemptions")
    .select("id")
    .eq("trial_code_id", trialCode.id)
    .eq("user_id", input.userId)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (duplicateRedemption) {
    return { ok: false, reason: "duplicate_trial_code_user" };
  }

  const validUntil = addDays(now, trialCode.trial_days).toISOString();

  const { error: claimError } = await client.from("machine_trial_claims").insert({
    machine_code_hash: input.machineCodeHash,
    user_id: input.userId,
    trial_code_id: trialCode.id,
    feature_code: CLOUD_SYNC_FEATURE,
    trial_started_at: now.toISOString(),
    trial_valid_until: validUntil,
  });

  if (claimError) {
    return { ok: false, reason: "machine_trial_used" };
  }

  const { error: redemptionError } = await client.from("trial_code_redemptions").insert({
    trial_code_id: trialCode.id,
    user_id: input.userId,
    machine_code_hash: input.machineCodeHash,
    feature_code: CLOUD_SYNC_FEATURE,
    redeemed_at: now.toISOString(),
    trial_valid_until: validUntil,
  });

  if (redemptionError) {
    throw new Error("Unable to save trial redemption");
  }

  await client
    .from("trial_codes")
    .update({ redemption_count: trialCode.redemption_count + 1 })
    .eq("id", trialCode.id);

  return { ok: true, validUntil };
}
```

- [ ] **Step 4: Add dashboard server action**

Modify `src/app/[locale]/dashboard/actions.ts`:

```ts
import { redeemTrialCode } from "@/lib/license/trial-codes";
```

Extend `getDashboardPath` union with:

```ts
| { trial: "saved" | "invalid" | "inactive" | "limit" | "machine_used" | "duplicate" | "error" }
```

Add action:

```ts
export async function redeemDashboardTrialCode(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/dashboard`);
  const code = String(formData.get("trial_code") ?? "").trim();
  const desktopSessionId = String(formData.get("desktop_session_id") ?? "").trim();

  if (!code || !desktopSessionId) {
    redirect(getDashboardPath(safeLocale, { trial: "invalid" }));
  }

  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from("desktop_sessions")
    .select("id,machine_code_hash")
    .eq("id", desktopSessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) {
    redirect(getDashboardPath(safeLocale, { trial: "invalid" }));
  }

  const result = await redeemTrialCode(supabase, {
    userId: user.id,
    code,
    machineCodeHash: session.machine_code_hash,
  });

  if (result.ok) {
    revalidatePath(`/${safeLocale}/dashboard`);
    redirect(getDashboardPath(safeLocale, { trial: "saved" }));
  }

  const statusByReason = {
    trial_code_invalid: "invalid",
    trial_code_inactive: "inactive",
    trial_code_limit_reached: "limit",
    machine_trial_used: "machine_used",
    duplicate_trial_code_user: "duplicate",
  } as const;

  redirect(getDashboardPath(safeLocale, { trial: statusByReason[result.reason] ?? "error" }));
}
```

- [ ] **Step 5: Add dashboard UI**

Modify `src/app/[locale]/dashboard/page.tsx`:

- Query recent `desktop_sessions` for the signed-in user: `id,device_id,platform,app_version,last_seen_at`.
- Add a card titled `Trial code`.
- Add a select named `desktop_session_id` listing recent desktop sessions.
- Add an input named `trial_code`.
- Use `redeemDashboardTrialCode.bind(null, locale)` as form action.
- Show status messages for `trial=saved`, `invalid`, `inactive`, `limit`, `machine_used`, `duplicate`, and `error`.

- [ ] **Step 6: Add translations**

Add under `dashboard` in each message file:

```json
"trial": {
  "title": "Trial code",
  "description": "Redeem a team-provided code to enable 3 days of cloud sync on one eligible computer.",
  "device": "Desktop device",
  "code": "Code",
  "submit": "Redeem trial",
  "saved": "Trial redeemed.",
  "invalid": "The trial code or selected device is invalid.",
  "inactive": "This trial code is not active.",
  "limit": "This trial code has reached its redemption limit.",
  "machineUsed": "This computer has already used a cloud sync trial.",
  "duplicate": "This account has already redeemed this trial code.",
  "error": "Could not redeem the trial code."
}
```

Use these exact localized values in the other message files.

`messages/zh-Hant.json`:

```json
"trial": {
  "title": "試用碼",
  "description": "兌換團隊提供的代碼，在一台符合條件的電腦上啟用 3 天雲端同步。",
  "device": "桌面裝置",
  "code": "代碼",
  "submit": "兌換試用",
  "saved": "試用已兌換。",
  "invalid": "試用碼或選擇的裝置無效。",
  "inactive": "此試用碼目前不可用。",
  "limit": "此試用碼已達兌換上限。",
  "machineUsed": "這台電腦已使用過雲端同步試用。",
  "duplicate": "此帳號已兌換過這個試用碼。",
  "error": "無法兌換試用碼。"
}
```

`messages/ja.json`:

```json
"trial": {
  "title": "トライアルコード",
  "description": "チームから提供されたコードを使用して、対象のコンピューター 1 台でクラウド同期を 3 日間有効にします。",
  "device": "デスクトップデバイス",
  "code": "コード",
  "submit": "トライアルを適用",
  "saved": "トライアルを適用しました。",
  "invalid": "トライアルコードまたは選択したデバイスが無効です。",
  "inactive": "このトライアルコードは有効ではありません。",
  "limit": "このトライアルコードは利用上限に達しています。",
  "machineUsed": "このコンピューターでは既にクラウド同期トライアルを使用済みです。",
  "duplicate": "このアカウントでは既にこのトライアルコードを使用済みです。",
  "error": "トライアルコードを適用できませんでした。"
}
```

`messages/ko.json`:

```json
"trial": {
  "title": "체험 코드",
  "description": "팀에서 제공한 코드를 사용해 조건에 맞는 컴퓨터 1대에서 클라우드 동기화를 3일 동안 활성화합니다.",
  "device": "데스크톱 기기",
  "code": "코드",
  "submit": "체험 사용",
  "saved": "체험이 적용되었습니다.",
  "invalid": "체험 코드 또는 선택한 기기가 올바르지 않습니다.",
  "inactive": "이 체험 코드는 활성 상태가 아닙니다.",
  "limit": "이 체험 코드는 사용 한도에 도달했습니다.",
  "machineUsed": "이 컴퓨터는 이미 클라우드 동기화 체험을 사용했습니다.",
  "duplicate": "이 계정은 이미 이 체험 코드를 사용했습니다.",
  "error": "체험 코드를 적용할 수 없습니다."
}
```

- [ ] **Step 7: Run tests**

```bash
npm test -- --run tests/unit/trial-codes.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/license/trial-codes.ts src/app/[locale]/dashboard/actions.ts src/app/[locale]/dashboard/page.tsx messages tests/unit/trial-codes.test.ts
git commit -m "Add trial code redemption"
```

---

## Task 6: License Status And Desktop Session Validation

**Files:**
- Create: `src/lib/license/desktop-session.ts`
- Create: `src/lib/license/status.ts`
- Create: `src/app/api/license/status/route.ts`
- Test: `tests/unit/license-status.test.ts`

- [ ] **Step 1: Write failing status tests**

Create `tests/unit/license-status.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getLicenseStatus } from "@/lib/license/status";

function createStatusClient({ paidUntil, trialUntil }: { paidUntil?: string | null; trialUntil?: string | null }) {
  const from = vi.fn((table: string) => {
    if (table === "license_entitlements") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: vi.fn(async () => ({
                data: paidUntil ? { valid_until: paidUntil, status: "active" } : null,
                error: null,
              })),
            }),
          }),
        }),
      };
    }
    if (table === "machine_trial_claims") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: vi.fn(async () => ({
                data: trialUntil ? { trial_valid_until: trialUntil } : null,
                error: null,
              })),
            }),
          }),
        }),
      };
    }
    if (table === "cloud_sync_leases") {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return { from };
}

describe("getLicenseStatus", () => {
  it("allows active paid entitlement before checking trial", async () => {
    const status = await getLicenseStatus(createStatusClient({ paidUntil: "2026-06-01T00:00:00.000Z" }), {
      userId: "user-1",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status.allowed).toBe(true);
    expect(status.source).toBe("paid");
    expect(status.reason).toBe("active");
  });

  it("allows active trial when paid entitlement is missing", async () => {
    const status = await getLicenseStatus(createStatusClient({ trialUntil: "2026-05-04T00:00:00.000Z" }), {
      userId: "user-1",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status.allowed).toBe(true);
    expect(status.source).toBe("trial");
    expect(status.reason).toBe("trial_active");
  });

  it("requires trial code redemption when no entitlement or trial exists", async () => {
    const status = await getLicenseStatus(createStatusClient({}), {
      userId: "user-1",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(status.allowed).toBe(false);
    expect(status.reason).toBe("trial_code_required");
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --run tests/unit/license-status.test.ts
```

Expected: FAIL because `src/lib/license/status.ts` does not exist.

- [ ] **Step 3: Implement desktop session validation**

Create `src/lib/license/desktop-session.ts`:

```ts
import { hashDesktopSecret } from "@/lib/license/hash";

type Client = { from: (table: string) => any };

export type DesktopSession = {
  id: string;
  user_id: string;
  device_id: string;
  machine_code_hash: string;
  platform: string;
  app_version: string | null;
};

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function validateDesktopSession(client: Client, token: string, now = new Date()) {
  const tokenHash = await hashDesktopSecret(token, "desktop_token");
  const { data, error } = await client
    .from("desktop_sessions")
    .select("id,user_id,device_id,machine_code_hash,platform,app_version,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at || new Date(data.expires_at) <= now) {
    return null;
  }

  await client.from("desktop_sessions").update({ last_seen_at: now.toISOString() }).eq("id", data.id);

  return data as DesktopSession;
}
```

- [ ] **Step 4: Implement status service**

Create `src/lib/license/status.ts`:

```ts
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { getCloudSyncEntitlementStatus } from "@/lib/license/entitlements";

type Client = { from: (table: string) => any };

type StatusInput = {
  userId: string;
  machineCodeHash: string;
  now?: Date;
};

function remainingDaysUntil(value: string, now: Date) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - now.getTime()) / 86_400_000));
}

export async function getLicenseStatus(client: Client, input: StatusInput) {
  const now = input.now ?? new Date();
  const paid = await getCloudSyncEntitlementStatus(client, input.userId, now);

  if (paid.allowed) {
    return { ...paid, feature: CLOUD_SYNC_FEATURE };
  }

  const { data: trial } = await client
    .from("machine_trial_claims")
    .select("trial_valid_until")
    .eq("machine_code_hash", input.machineCodeHash)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();

  if (trial?.trial_valid_until && new Date(trial.trial_valid_until) > now) {
    return {
      allowed: true,
      authenticated: true,
      feature: CLOUD_SYNC_FEATURE,
      reason: "trial_active" as const,
      source: "trial" as const,
      validUntil: trial.trial_valid_until,
      remainingDays: remainingDaysUntil(trial.trial_valid_until, now),
    };
  }

  if (trial?.trial_valid_until) {
    return {
      allowed: false,
      authenticated: true,
      feature: CLOUD_SYNC_FEATURE,
      reason: "trial_expired" as const,
      validUntil: trial.trial_valid_until,
      remainingDays: 0,
    };
  }

  return {
    allowed: false,
    authenticated: true,
    feature: CLOUD_SYNC_FEATURE,
    reason: paid.reason === "no_entitlement" ? ("trial_code_required" as const) : paid.reason,
    validUntil: paid.validUntil,
    remainingDays: 0,
  };
}
```

- [ ] **Step 5: Add status route**

Create `src/app/api/license/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feature = url.searchParams.get("feature") ?? CLOUD_SYNC_FEATURE;

  if (feature !== CLOUD_SYNC_FEATURE) {
    return NextResponse.json({
      authenticated: false,
      feature,
      allowed: false,
      reason: "unsupported_feature",
    });
  }

  const token = readBearerToken(request);

  if (!token) {
    return NextResponse.json({
      authenticated: false,
      feature,
      allowed: false,
      reason: "not_authenticated",
    }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const session = await validateDesktopSession(supabase, token);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      feature,
      allowed: false,
      reason: "not_authenticated",
    }, { status: 401 });
  }

  const status = await getLicenseStatus(supabase, {
    userId: session.user_id,
    machineCodeHash: session.machine_code_hash,
  });

  return NextResponse.json({
    authenticated: true,
    ...status,
    activeDeviceId: session.device_id,
  });
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --run tests/unit/license-status.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/license/desktop-session.ts src/lib/license/status.ts src/app/api/license/status/route.ts tests/unit/license-status.test.ts
git commit -m "Add desktop license status API"
```

---

## Task 7: Cloud Sync Lease APIs

**Files:**
- Create: `src/lib/license/cloud-sync-leases.ts`
- Create: `src/app/api/license/cloud-sync/activate/route.ts`
- Create: `src/app/api/license/cloud-sync/heartbeat/route.ts`
- Create: `src/app/api/license/cloud-sync/release/route.ts`
- Test: `tests/unit/cloud-sync-leases.test.ts`

- [ ] **Step 1: Write failing lease tests**

Create `tests/unit/cloud-sync-leases.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { activateCloudSyncLease, heartbeatCloudSyncLease, releaseCloudSyncLease } from "@/lib/license/cloud-sync-leases";

function createLeaseClient() {
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const insertSingle = vi.fn(async () => ({ data: { id: "lease-2" }, error: null }));
  const select = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select }));
  const maybeSingle = vi.fn(async () => ({
    data: {
      id: "lease-2",
      desktop_session_id: "session-2",
      expires_at: "2026-05-01T00:02:00.000Z",
      revoked_at: null,
    },
    error: null,
  }));
  const from = vi.fn(() => ({
    update,
    insert,
    select: () => ({ eq: () => ({ is: () => ({ maybeSingle }) }) }),
  }));

  return { from, update, insert };
}

describe("cloud sync leases", () => {
  it("activation revokes previous lease and creates a lease for current session", async () => {
    const client = createLeaseClient();

    const result = await activateCloudSyncLease(client, {
      userId: "user-1",
      desktopSessionId: "session-2",
      deviceId: "device-b",
      machineCodeHash: "machine-hash",
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result.allowed).toBe(true);
    expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: "2026-05-01T00:00:00.000Z" }));
    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({ desktop_session_id: "session-2" }));
  });

  it("heartbeat allows the current lease owner", async () => {
    const client = createLeaseClient();

    const result = await heartbeatCloudSyncLease(client, {
      userId: "user-1",
      desktopSessionId: "session-2",
      now: new Date("2026-05-01T00:01:00.000Z"),
    });

    expect(result).toEqual({ allowed: true, reason: "active" });
  });

  it("release revokes current session lease", async () => {
    const client = createLeaseClient();

    await releaseCloudSyncLease(client, {
      userId: "user-1",
      desktopSessionId: "session-2",
      now: new Date("2026-05-01T00:01:00.000Z"),
    });

    expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: "2026-05-01T00:01:00.000Z" }));
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --run tests/unit/cloud-sync-leases.test.ts
```

Expected: FAIL because `src/lib/license/cloud-sync-leases.ts` does not exist.

- [ ] **Step 3: Implement lease service**

Create `src/lib/license/cloud-sync-leases.ts`:

```ts
import { CLOUD_SYNC_LEASE_TTL_SECONDS } from "@/lib/license/constants";

type Client = { from: (table: string) => any };

type LeaseIdentity = {
  userId: string;
  desktopSessionId: string;
  deviceId?: string;
  machineCodeHash?: string;
  now?: Date;
};

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

export async function activateCloudSyncLease(client: Client, input: Required<Pick<LeaseIdentity, "userId" | "desktopSessionId" | "deviceId" | "machineCodeHash">> & { now?: Date }) {
  const now = input.now ?? new Date();
  const expiresAt = addSeconds(now, CLOUD_SYNC_LEASE_TTL_SECONDS).toISOString();

  await client
    .from("cloud_sync_leases")
    .update({ revoked_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("user_id", input.userId)
    .is("revoked_at", null);

  const { data, error } = await client
    .from("cloud_sync_leases")
    .insert({
      user_id: input.userId,
      desktop_session_id: input.desktopSessionId,
      device_id: input.deviceId,
      machine_code_hash: input.machineCodeHash,
      lease_started_at: now.toISOString(),
      last_heartbeat_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to activate cloud sync lease");
  }

  return { allowed: true, reason: "active" as const, leaseId: data.id, expiresAt };
}

export async function heartbeatCloudSyncLease(client: Client, input: Pick<LeaseIdentity, "userId" | "desktopSessionId" | "now">) {
  const now = input.now ?? new Date();
  const { data } = await client
    .from("cloud_sync_leases")
    .select("id,desktop_session_id,expires_at,revoked_at")
    .eq("user_id", input.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!data || data.desktop_session_id !== input.desktopSessionId || new Date(data.expires_at) <= now) {
    return { allowed: false, reason: "active_on_another_device" as const };
  }

  await client
    .from("cloud_sync_leases")
    .update({
      last_heartbeat_at: now.toISOString(),
      expires_at: addSeconds(now, CLOUD_SYNC_LEASE_TTL_SECONDS).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", data.id);

  return { allowed: true, reason: "active" as const };
}

export async function releaseCloudSyncLease(client: Client, input: Pick<LeaseIdentity, "userId" | "desktopSessionId" | "now">) {
  const now = input.now ?? new Date();

  await client
    .from("cloud_sync_leases")
    .update({ revoked_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("user_id", input.userId)
    .eq("desktop_session_id", input.desktopSessionId)
    .is("revoked_at", null);
}
```

- [ ] **Step 4: Add route handlers**

Create `src/app/api/license/cloud-sync/activate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { activateCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { getLicenseStatus } from "@/lib/license/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const session = await validateDesktopSession(supabase, token);
  if (!session) {
    return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
  }

  const status = await getLicenseStatus(supabase, {
    userId: session.user_id,
    machineCodeHash: session.machine_code_hash,
  });

  if (!status.allowed) {
    return NextResponse.json(status, { status: 403 });
  }

  const lease = await activateCloudSyncLease(supabase, {
    userId: session.user_id,
    desktopSessionId: session.id,
    deviceId: session.device_id,
    machineCodeHash: session.machine_code_hash,
  });

  return NextResponse.json({ ...lease, activeDeviceId: session.device_id });
}
```

Create `src/app/api/license/cloud-sync/heartbeat/route.ts`:

```ts
import { NextResponse } from "next/server";
import { heartbeatCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const session = await validateDesktopSession(supabase, token);
  if (!session) {
    return NextResponse.json({ allowed: false, reason: "not_authenticated" }, { status: 401 });
  }

  const result = await heartbeatCloudSyncLease(supabase, {
    userId: session.user_id,
    desktopSessionId: session.id,
  });

  return NextResponse.json(
    { ...result, activeDeviceId: session.device_id },
    { status: result.allowed ? 200 : 409 },
  );
}
```

Create `src/app/api/license/cloud-sync/release/route.ts`:

```ts
import { NextResponse } from "next/server";
import { releaseCloudSyncLease } from "@/lib/license/cloud-sync-leases";
import { readBearerToken, validateDesktopSession } from "@/lib/license/desktop-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return NextResponse.json({ released: false, reason: "not_authenticated" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const session = await validateDesktopSession(supabase, token);
  if (!session) {
    return NextResponse.json({ released: false, reason: "not_authenticated" }, { status: 401 });
  }

  await releaseCloudSyncLease(supabase, {
    userId: session.user_id,
    desktopSessionId: session.id,
  });

  return NextResponse.json({ released: true });
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --run tests/unit/cloud-sync-leases.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/license/cloud-sync-leases.ts src/app/api/license/cloud-sync tests/unit/cloud-sync-leases.test.ts
git commit -m "Add cloud sync lease APIs"
```

---

## Task 8: Admin License And Trial Code Management

**Files:**
- Create: `src/app/[locale]/admin/licenses/page.tsx`
- Modify: `src/app/[locale]/admin/actions.ts`
- Modify: `src/app/[locale]/admin/page.tsx`
- Modify: `messages/*.json`
- Test: `tests/unit/admin-license-actions.test.ts`

- [ ] **Step 1: Write admin action tests**

Create `tests/unit/admin-license-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTrialCode, setTrialCodeActive } from "@/app/[locale]/admin/actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

describe("admin license actions", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseAdminClient.mockReset();
    mocks.revalidatePath.mockClear();
  });

  it("creates hashed trial codes", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("code", "SPRING-2026");
    formData.set("label", "Spring launch");
    formData.set("starts_at", "2026-05-01T00:00");
    formData.set("ends_at", "2026-06-01T00:00");
    formData.set("max_redemptions", "100");
    formData.set("trial_days", "3");

    await createTrialCode(formData);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      label: "Spring launch",
      trial_days: 3,
      max_redemptions: 100,
      created_by: "admin-1",
      is_active: true,
    }));
    expect(JSON.stringify(insert.mock.calls[0][0])).not.toContain("SPRING-2026");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/licenses");
  });

  it("activates and deactivates trial codes", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => ({ update })) });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("trial_code_id", "code-1");
    formData.set("is_active", "false");

    await setTrialCodeActive(formData);

    expect(update).toHaveBeenCalledWith({ is_active: false });
    expect(eq).toHaveBeenCalledWith("id", "code-1");
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- --run tests/unit/admin-license-actions.test.ts
```

Expected: FAIL because admin actions do not exist.

- [ ] **Step 3: Add admin actions**

Modify `src/app/[locale]/admin/actions.ts`.

Add import:

```ts
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";
```

Append these actions after `setSoftwareReleasePublished`:

```ts
function getPositiveInteger(formData: FormData, key: string, message: string) {
  const value = Number(formData.get(key));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

function getOptionalPositiveInteger(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
}

function getRequiredDateTime(formData: FormData, key: string) {
  const value = getRequiredString(formData, key, `${key} is required`);
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${key} is invalid`);
  }

  return date.toISOString();
}

export async function createTrialCode(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const code = getRequiredString(formData, "code", "Trial code is required");
  const label = getRequiredString(formData, "label", "Label is required");
  const trialDays = getPositiveInteger(formData, "trial_days", "Trial days must be positive");
  const maxRedemptions = getOptionalPositiveInteger(formData, "max_redemptions");
  const startsAt = getRequiredDateTime(formData, "starts_at");
  const endsAt = getRequiredDateTime(formData, "ends_at");
  const codeHash = await hashDesktopSecret(code, "trial_code");
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("trial_codes").insert({
    code_hash: codeHash,
    created_by: admin.id,
    ends_at: endsAt,
    feature_code: CLOUD_SYNC_FEATURE,
    is_active: true,
    label,
    max_redemptions: maxRedemptions,
    starts_at: startsAt,
    trial_days: trialDays,
  });

  if (error) {
    throw new Error("Unable to create trial code");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function setTrialCodeActive(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const trialCodeId = getRequiredString(formData, "trial_code_id", "Trial code is required");
  const isActive = String(formData.get("is_active") ?? "false") === "true";
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("trial_codes").update({ is_active: isActive }).eq("id", trialCodeId);

  if (error) {
    throw new Error("Unable to update trial code");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function revokeDesktopSession(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const desktopSessionId = getRequiredString(formData, "desktop_session_id", "Desktop session is required");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("desktop_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", desktopSessionId);

  if (error) {
    throw new Error("Unable to revoke desktop session");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function revokeCloudSyncLease(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const leaseId = getRequiredString(formData, "cloud_sync_lease_id", "Cloud sync lease is required");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cloud_sync_leases")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", leaseId);

  if (error) {
    throw new Error("Unable to revoke cloud sync lease");
  }

  revalidatePath(`/${locale}/admin/licenses`);
}

export async function extendLicenseEntitlement(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const days = getPositiveInteger(formData, "days", "Days must be positive");
  const now = new Date();
  const supabase = createSupabaseAdminClient();
  const { data: current } = await supabase
    .from("license_entitlements")
    .select("valid_until")
    .eq("user_id", userId)
    .eq("feature_code", CLOUD_SYNC_FEATURE)
    .maybeSingle();
  const base = current?.valid_until && new Date(current.valid_until) > now ? new Date(current.valid_until) : now;
  base.setUTCDate(base.getUTCDate() + days);
  const { error } = await supabase.from("license_entitlements").upsert(
    {
      feature_code: CLOUD_SYNC_FEATURE,
      status: "active",
      user_id: userId,
      valid_until: base.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id,feature_code" },
  );

  if (error) {
    throw new Error("Unable to extend license entitlement");
  }

  revalidatePath(`/${locale}/admin/licenses`);
  revalidatePath(`/${locale}/dashboard`);
}
```

- [ ] **Step 4: Add admin page**

Create `src/app/[locale]/admin/licenses/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createTrialCode,
  revokeCloudSyncLease,
  revokeDesktopSession,
  setTrialCodeActive,
} from "../actions";

type AdminLicensesPageProps = {
  params: Promise<{ locale: string }>;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminLicensesPage({ params }: AdminLicensesPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations("admin.licenses");
  const supabase = createSupabaseAdminClient();
  const [trialCodes, entitlements, sessions, leases] = await Promise.all([
    supabase
      .from("trial_codes")
      .select("id,label,trial_days,starts_at,ends_at,max_redemptions,redemption_count,is_active,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("license_entitlements")
      .select("id,user_id,feature_code,valid_until,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("desktop_sessions")
      .select("id,user_id,device_id,platform,app_version,last_seen_at,expires_at,revoked_at")
      .order("last_seen_at", { ascending: false })
      .limit(50),
    supabase
      .from("cloud_sync_leases")
      .select("id,user_id,desktop_session_id,device_id,last_heartbeat_at,expires_at,revoked_at")
      .order("last_heartbeat_at", { ascending: false })
      .limit(50),
  ]);

  if (trialCodes.error) throw trialCodes.error;
  if (entitlements.error) throw entitlements.error;
  if (sessions.error) throw sessions.error;
  if (leases.error) throw leases.error;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">{t("eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
          </div>

          <section className="mt-8 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-950">{t("createTrialTitle")}</h2>
            </div>
            <form action={createTrialCode} className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <input type="hidden" name="locale" value={locale} />
              <input className="rounded-md border border-slate-300 px-3 py-2" name="code" placeholder={t("code")} />
              <input className="rounded-md border border-slate-300 px-3 py-2" name="label" placeholder={t("label")} />
              <input className="rounded-md border border-slate-300 px-3 py-2" name="trial_days" defaultValue="3" />
              <input className="rounded-md border border-slate-300 px-3 py-2" name="max_redemptions" placeholder={t("maxRedemptions")} />
              <input className="rounded-md border border-slate-300 px-3 py-2" type="datetime-local" name="starts_at" />
              <input className="rounded-md border border-slate-300 px-3 py-2" type="datetime-local" name="ends_at" />
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white md:col-span-2" type="submit">
                {t("createTrial")}
              </button>
            </form>
          </section>

          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-950">{t("trialCodesTitle")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("label")}</th>
                    <th className="px-5 py-3">{t("period")}</th>
                    <th className="px-5 py-3">{t("redemptions")}</th>
                    <th className="px-5 py-3">{t("status")}</th>
                    <th className="px-5 py-3">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(trialCodes.data ?? []).map((code) => (
                    <tr key={code.id}>
                      <td className="px-5 py-4 font-medium text-slate-950">{code.label}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(code.starts_at, locale)} - {formatDate(code.ends_at, locale)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {code.redemption_count}/{code.max_redemptions ?? "∞"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{code.is_active ? t("active") : t("inactive")}</td>
                      <td className="px-5 py-4">
                        <form action={setTrialCodeActive}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="trial_code_id" value={code.id} />
                          <input type="hidden" name="is_active" value={String(!code.is_active)} />
                          <button className="text-sm font-semibold text-slate-950" type="submit">
                            {code.is_active ? t("deactivate") : t("activate")}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-950">{t("desktopSessionsTitle")}</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {(sessions.data ?? []).map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-medium text-slate-950">{session.device_id}</p>
                      <p className="text-sm text-slate-600">{session.platform} · {formatDate(session.last_seen_at, locale)}</p>
                    </div>
                    <form action={revokeDesktopSession}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="desktop_session_id" value={session.id} />
                      <button className="text-sm font-semibold text-red-700" type="submit">{t("revoke")}</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-950">{t("leasesTitle")}</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {(leases.data ?? []).map((lease) => (
                  <div key={lease.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-medium text-slate-950">{lease.device_id}</p>
                      <p className="text-sm text-slate-600">{formatDate(lease.last_heartbeat_at, locale)}</p>
                    </div>
                    <form action={revokeCloudSyncLease}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="cloud_sync_lease_id" value={lease.id} />
                      <button className="text-sm font-semibold text-red-700" type="submit">{t("revoke")}</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Add admin overview link and translations**

Modify `src/app/[locale]/admin/page.tsx` to add `/admin/licenses`.

Add under `admin.overview`:

```json
"licensesTitle": "Licenses",
"licensesDescription": "Manage cloud sync entitlements, trial codes, desktop devices, and active leases."
```

Add `admin.licenses` message group in all four locales with these keys: `eyebrow`, `title`, `createTrialTitle`, `code`, `label`, `maxRedemptions`, `createTrial`, `trialCodesTitle`, `period`, `redemptions`, `status`, `actions`, `active`, `inactive`, `deactivate`, `activate`, `desktopSessionsTitle`, `leasesTitle`, and `revoke`.

- [ ] **Step 6: Run tests**

```bash
npm test -- --run tests/unit/admin-license-actions.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/admin/actions.ts src/app/[locale]/admin/licenses/page.tsx src/app/[locale]/admin/page.tsx messages tests/unit/admin-license-actions.test.ts
git commit -m "Add admin license management"
```

---

## Task 9: E2E Coverage And Final Verification

**Files:**
- Create: `tests/e2e/desktop-license.spec.ts`

- [ ] **Step 1: Add E2E tests**

Create `tests/e2e/desktop-license.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("license status rejects anonymous desktop requests", async ({ request }) => {
  const response = await request.get("/api/license/status?feature=cloud_sync");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    authenticated: false,
    allowed: false,
    reason: "not_authenticated",
  });
});

test("unsupported license feature is denied", async ({ request }) => {
  const response = await request.get("/api/license/status?feature=unknown");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    allowed: false,
    reason: "unsupported_feature",
  });
});

test("public pages still load after license feature work", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for macOS" })).toBeVisible();
});
```

- [ ] **Step 2: Run all verification commands**

```bash
npm run lint
npm test
npm run build
npm run e2e
```

Expected:

- `npm run lint`: exits 0.
- `npm test`: all unit tests pass.
- `npm run build`: production build succeeds.
- `npm run e2e`: all Playwright tests pass.

- [ ] **Step 3: Commit final E2E tests**

```bash
git add tests/e2e/desktop-license.spec.ts
git commit -m "Add desktop license e2e coverage"
```

- [ ] **Step 4: Final status check**

```bash
git status --short
git log --oneline -5
```

Expected: clean worktree and recent commits for each task.
