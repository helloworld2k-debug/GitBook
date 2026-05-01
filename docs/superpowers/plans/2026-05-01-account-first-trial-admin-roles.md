# Account-First Trial And Admin Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users redeem trial codes without choosing a desktop device, bind the machine automatically when the desktop app first logs in, and add owner/operator admin permissions.

**Architecture:** Trial redemption becomes account-first: `trial_code_redemptions` starts the 3-day timer and may be unbound; desktop auth exchange binds the first machine code atomically and writes `machine_trial_claims`. Admin permissions keep `profiles.is_admin` for compatibility and add `admin_role` plus `account_status` for owner/operator/user controls.

**Tech Stack:** Next.js App Router server actions, Supabase PostgreSQL/RPC/RLS, TypeScript, Vitest, Vercel.

---

## Task 1: Database Migration For Account Trials And Admin Roles

**Files:**
- Create: `supabase/migrations/0008_account_first_trials_admin_roles.sql`
- Modify: `src/lib/database.types.ts`
- Test: `tests/unit/account-first-trial-migration.test.ts`

**Steps:**
- Add `admin_role` and `account_status` columns to `profiles`.
- Backfill existing `is_admin=true` users to `owner`.
- Allow `trial_code_redemptions.machine_code_hash` to be nullable and add `bound_at`, `desktop_session_id`, `device_id`.
- Replace `redeem_trial_code` with an account-first RPC.
- Replace `exchange_desktop_auth_code` so desktop login binds an unbound active trial to the machine code if the machine has never claimed a trial.
- Preserve `machine_trial_claims unique (machine_code_hash, feature_code)`.
- Add tests that SQL contains account-first redemption, machine binding, owner/operator columns, and service-role grants.

## Task 2: App Logic For Account-First Trials

**Files:**
- Modify: `src/lib/license/trial-codes.ts`
- Modify: `src/lib/license/status.ts`
- Modify: `src/app/[locale]/dashboard/actions.ts`
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `messages/*.json`
- Test: `tests/unit/trial-codes.test.ts`
- Test: `tests/unit/license-status.test.ts`
- Test: `tests/unit/dashboard-account-actions.test.ts`

**Steps:**
- Change `redeemTrialCode` to call `redeem_trial_code(input_user_id, input_code_hash, input_now)` without machine hash.
- Dashboard removes `Desktop device` and only asks for trial code.
- License status checks paid first, then machine-bound trial claims; if the account has an active unbound trial but this desktop has not been bound yet, return `trial_machine_required` or rely on desktop auth exchange to bind before status checks.
- Update messages so users never see machine-code internals.

## Task 3: Admin Permission Helpers And User Management

**Files:**
- Modify: `src/lib/auth/guards.ts`
- Modify: `src/app/[locale]/admin/actions.ts`
- Modify: `src/app/[locale]/admin/page.tsx`
- Create: `src/app/[locale]/admin/users/page.tsx`
- Modify: `messages/*.json`
- Test: `tests/unit/auth-guards.test.ts`
- Test: `tests/unit/admin-user-actions.test.ts`

**Steps:**
- Add `requireOperator` for owner/operator and `requireOwner` for owner-only.
- Keep old `requireAdmin` as an alias to `requireOperator` so existing admin pages continue working.
- Owner can promote/demote operators and update user account status.
- Operators can manage trial codes and user status but cannot create owners/operators or inspect secrets/passwords.
- Add admin user page showing email, display name, role, status, trial redemption/binding state, desktop sessions, and safe machine-code short hashes.

## Task 4: Admin License Page Binding Visibility

**Files:**
- Modify: `src/app/[locale]/admin/licenses/page.tsx`
- Modify: `messages/*.json`
- Test: `tests/unit/admin-pages.test.tsx`

**Steps:**
- Show trial redemptions with account email, trial valid-until, unbound/bound status, device id, and short machine hash.
- Show desktop session machine hash short IDs to administrators.
- Keep raw machine code hidden.

## Task 5: Verification And Deploy

**Commands:**
- `npm run lint`
- `npm test`
- `npm run build`
- Apply migration `0008_account_first_trials_admin_roles.sql` to Supabase with `psql`.
- Push `main` and verify Vercel deployment.

**Success Criteria:**
- Website trial redemption works without desktop device selection.
- Desktop auth exchange binds first eligible unbound trial to one machine.
- The same machine cannot be reused for another trial account.
- Admin owner/operator roles work without exposing passwords.
