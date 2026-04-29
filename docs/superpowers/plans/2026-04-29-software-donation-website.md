# Software Donation Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-ready version of an international software download site with public downloads, login-required one-time donations, user donation history, backend-managed certificates, and lightweight admin tooling.

**Architecture:** Use a Next.js App Router application deployed to Vercel, with Supabase Auth/Postgres for accounts and data, Stripe and PayPal for one-time donation checkout, and server-side certificate generation. Public downloads remain open; donation, dashboard, certificate, and admin actions are protected by server-side auth checks.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, next-intl, Supabase Auth/Postgres, Stripe Checkout, PayPal Checkout, Vitest, Testing Library, Playwright.

---

## File Structure

Create the project as a focused Next.js app. Keep domain logic in `src/lib`, route handlers in `src/app`, and SQL in `supabase/migrations`.

- `src/i18n/routing.ts`: supported locales, default locale, localized route helpers.
- `src/i18n/request.ts`: next-intl request configuration.
- `messages/en.json`, `messages/zh-Hant.json`, `messages/ja.json`, `messages/ko.json`: localized copy.
- `src/config/site.ts`: product name, download links, donation amounts, sponsor thresholds.
- `src/lib/supabase/server.ts`: server Supabase client helpers.
- `src/lib/supabase/client.ts`: browser Supabase client helper.
- `src/lib/auth/guards.ts`: login and admin guards.
- `src/lib/payments/stripe.ts`: Stripe checkout and webhook utilities.
- `src/lib/payments/paypal.ts`: PayPal order and webhook utilities.
- `src/lib/certificates/numbers.ts`: certificate number generation contract.
- `src/lib/certificates/levels.ts`: cumulative sponsor level calculation.
- `src/lib/certificates/render.tsx`: certificate rendering component shared by page/export.
- `src/app/[locale]/page.tsx`: public download homepage.
- `src/app/[locale]/donate/page.tsx`: login-required donation page.
- `src/app/[locale]/dashboard/page.tsx`: user dashboard.
- `src/app/[locale]/dashboard/certificates/[id]/page.tsx`: certificate detail.
- `src/app/[locale]/admin/page.tsx`: admin overview.
- `src/app/api/checkout/stripe/route.ts`: Stripe checkout session creation.
- `src/app/api/checkout/paypal/route.ts`: PayPal order creation.
- `src/app/api/webhooks/stripe/route.ts`: Stripe webhook handler.
- `src/app/api/webhooks/paypal/route.ts`: PayPal webhook handler.
- `src/app/api/certificates/[id]/png/route.ts`: PNG export endpoint.
- `src/app/api/certificates/[id]/pdf/route.ts`: PDF export endpoint.
- `supabase/migrations/0001_initial_schema.sql`: database schema, RLS, functions, seed tiers.
- `tests/unit/*.test.ts`: domain and route logic tests.
- `tests/e2e/*.spec.ts`: browser flows.

---

### Task 1: Scaffold Next.js App and Tooling

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/globals.css`
- Modify: `.gitignore`

- [ ] **Step 1: Scaffold the app**

Run:

```bash
npx create-next-app@latest . --ts --eslint --tailwind --app --src-dir --import-alias "@/*"
```

Expected: Next.js files are created in the current directory without deleting `docs/` or `.gitignore`.

- [ ] **Step 2: Install runtime dependencies**

Run:

```bash
npm install next-intl @supabase/ssr @supabase/supabase-js stripe @paypal/paypal-server-sdk zod
```

Expected: dependencies are added to `package.json`.

- [ ] **Step 3: Install test dependencies**

Run:

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: dev dependencies are added to `package.json`.

- [ ] **Step 4: Set scripts in `package.json`**

Ensure `package.json` contains these scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

- [ ] **Step 7: Verify scaffold**

Run:

```bash
npm run lint
npm test
```

Expected: lint passes; tests pass or report no tests found without TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json vitest.config.ts playwright.config.ts src tests .gitignore
git commit -m "chore: scaffold next app"
```

---

### Task 2: Add Site Configuration and Internationalization

**Files:**
- Create: `src/config/site.ts`
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`
- Create: `src/middleware.ts`
- Create: `messages/en.json`
- Create: `messages/zh-Hant.json`
- Create: `messages/ja.json`
- Create: `messages/ko.json`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/unit/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { donationTiers, sponsorLevels, supportedLocales } from "@/config/site";

describe("site config", () => {
  it("uses English as the default supported locale", () => {
    expect(supportedLocales[0]).toBe("en");
    expect(supportedLocales).toEqual(["en", "zh-Hant", "ja", "ko"]);
  });

  it("defines one-time USD donation tiers", () => {
    expect(donationTiers).toEqual([
      { code: "monthly", labelKey: "donate.tiers.monthly", amount: 500, currency: "usd" },
      { code: "quarterly", labelKey: "donate.tiers.quarterly", amount: 1500, currency: "usd" },
      { code: "yearly", labelKey: "donate.tiers.yearly", amount: 5000, currency: "usd" },
    ]);
  });

  it("defines cumulative sponsor thresholds in ascending order", () => {
    expect(sponsorLevels.map((level) => level.code)).toEqual(["bronze", "silver", "gold", "platinum"]);
    expect(sponsorLevels.map((level) => level.minimumAmount)).toEqual([500, 5000, 15000, 50000]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/config.test.ts
```

Expected: FAIL because `src/config/site.ts` does not exist.

- [ ] **Step 3: Add site config**

Create `src/config/site.ts`:

```ts
export const supportedLocales = ["en", "zh-Hant", "ja", "ko"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";

export const siteConfig = {
  name: "Three Friends",
  description: "Public software downloads supported by voluntary donations.",
  githubReleasesUrl: "https://github.com/threefriends/app/releases/latest",
  downloadLinks: {
    macos: "https://github.com/threefriends/app/releases/latest",
    windows: "https://github.com/threefriends/app/releases/latest",
    linux: "https://github.com/threefriends/app/releases/latest",
  },
};

export const donationTiers = [
  { code: "monthly", labelKey: "donate.tiers.monthly", amount: 500, currency: "usd" },
  { code: "quarterly", labelKey: "donate.tiers.quarterly", amount: 1500, currency: "usd" },
  { code: "yearly", labelKey: "donate.tiers.yearly", amount: 5000, currency: "usd" },
] as const;

export const sponsorLevels = [
  { code: "bronze", labelKey: "sponsors.levels.bronze", minimumAmount: 500, currency: "usd" },
  { code: "silver", labelKey: "sponsors.levels.silver", minimumAmount: 5000, currency: "usd" },
  { code: "gold", labelKey: "sponsors.levels.gold", minimumAmount: 15000, currency: "usd" },
  { code: "platinum", labelKey: "sponsors.levels.platinum", minimumAmount: 50000, currency: "usd" },
] as const;
```

- [ ] **Step 4: Add next-intl routing**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { defaultLocale, supportedLocales } from "@/config/site";

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale,
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
```

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Create `src/middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(en|zh-Hant|ja|ko)/:path*"],
};
```

- [ ] **Step 5: Add base messages**

Create `messages/en.json`:

```json
{
  "nav": {
    "download": "Download",
    "donate": "Donate",
    "sponsors": "Sponsors",
    "dashboard": "Dashboard",
    "signIn": "Sign in"
  },
  "home": {
    "title": "Three Friends",
    "subtitle": "Download the latest version freely. Support development when it helps you.",
    "downloadMac": "Download for macOS",
    "downloadWindows": "Download for Windows",
    "downloadLinux": "Download for Linux",
    "supportPrompt": "Downloads are free. Donations support ongoing development."
  },
  "donate": {
    "title": "Support development",
    "subtitle": "Choose a one-time support amount. These donations do not auto-renew.",
    "tiers": {
      "monthly": "Monthly Support",
      "quarterly": "Quarterly Support",
      "yearly": "Yearly Support"
    },
    "checkoutStripe": "Pay with Stripe",
    "checkoutPayPal": "Pay with PayPal"
  },
  "sponsors": {
    "title": "Supporters",
    "levels": {
      "bronze": "Bronze",
      "silver": "Silver",
      "gold": "Gold",
      "platinum": "Platinum"
    }
  },
  "dashboard": {
    "title": "Dashboard",
    "donations": "Donations",
    "certificates": "Certificates"
  }
}
```

Create `messages/zh-Hant.json`:

```json
{
  "nav": {
    "download": "下載",
    "donate": "贊助",
    "sponsors": "支持者",
    "dashboard": "儀表板",
    "signIn": "登入"
  },
  "home": {
    "title": "Three Friends",
    "subtitle": "自由下載最新版本。如果這個軟體幫助了你，也歡迎支持開發。",
    "downloadMac": "下載 macOS 版",
    "downloadWindows": "下載 Windows 版",
    "downloadLinux": "下載 Linux 版",
    "supportPrompt": "下載免費。捐贈將用於支持持續開發。"
  },
  "donate": {
    "title": "支持開發",
    "subtitle": "選擇一次性支持金額。這些捐贈不會自動續費。",
    "tiers": {
      "monthly": "月度支持",
      "quarterly": "季度支持",
      "yearly": "年度支持"
    },
    "checkoutStripe": "使用 Stripe 支付",
    "checkoutPayPal": "使用 PayPal 支付"
  },
  "sponsors": {
    "title": "支持者",
    "levels": {
      "bronze": "銅牌",
      "silver": "銀牌",
      "gold": "金牌",
      "platinum": "白金"
    }
  },
  "dashboard": {
    "title": "儀表板",
    "donations": "捐贈記錄",
    "certificates": "證書"
  }
}
```

Create `messages/ja.json`:

```json
{
  "nav": {
    "download": "ダウンロード",
    "donate": "寄付",
    "sponsors": "サポーター",
    "dashboard": "ダッシュボード",
    "signIn": "サインイン"
  },
  "home": {
    "title": "Three Friends",
    "subtitle": "最新版を自由にダウンロードできます。役に立った場合は開発支援をご検討ください。",
    "downloadMac": "macOS 版をダウンロード",
    "downloadWindows": "Windows 版をダウンロード",
    "downloadLinux": "Linux 版をダウンロード",
    "supportPrompt": "ダウンロードは無料です。寄付は継続的な開発を支えます。"
  },
  "donate": {
    "title": "開発を支援する",
    "subtitle": "一回限りの支援金額を選択してください。自動更新はありません。",
    "tiers": {
      "monthly": "月額相当の支援",
      "quarterly": "四半期相当の支援",
      "yearly": "年額相当の支援"
    },
    "checkoutStripe": "Stripe で支払う",
    "checkoutPayPal": "PayPal で支払う"
  },
  "sponsors": {
    "title": "サポーター",
    "levels": {
      "bronze": "ブロンズ",
      "silver": "シルバー",
      "gold": "ゴールド",
      "platinum": "プラチナ"
    }
  },
  "dashboard": {
    "title": "ダッシュボード",
    "donations": "寄付履歴",
    "certificates": "証明書"
  }
}
```

Create `messages/ko.json`:

```json
{
  "nav": {
    "download": "다운로드",
    "donate": "후원",
    "sponsors": "후원자",
    "dashboard": "대시보드",
    "signIn": "로그인"
  },
  "home": {
    "title": "Three Friends",
    "subtitle": "최신 버전을 자유롭게 다운로드하세요. 도움이 되었다면 개발을 후원할 수 있습니다.",
    "downloadMac": "macOS용 다운로드",
    "downloadWindows": "Windows용 다운로드",
    "downloadLinux": "Linux용 다운로드",
    "supportPrompt": "다운로드는 무료입니다. 후원은 지속적인 개발을 돕습니다."
  },
  "donate": {
    "title": "개발 후원",
    "subtitle": "일회성 후원 금액을 선택하세요. 자동 갱신되지 않습니다.",
    "tiers": {
      "monthly": "월간 후원",
      "quarterly": "분기 후원",
      "yearly": "연간 후원"
    },
    "checkoutStripe": "Stripe로 결제",
    "checkoutPayPal": "PayPal로 결제"
  },
  "sponsors": {
    "title": "후원자",
    "levels": {
      "bronze": "브론즈",
      "silver": "실버",
      "gold": "골드",
      "platinum": "플래티넘"
    }
  },
  "dashboard": {
    "title": "대시보드",
    "donations": "후원 내역",
    "certificates": "인증서"
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/unit/config.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/config src/i18n src/middleware.ts messages tests/unit/config.test.ts
git commit -m "feat: add i18n and site configuration"
```

---

### Task 3: Create Supabase Schema and Access Rules

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `src/lib/database.types.ts`
- Test: `tests/unit/certificate-numbers.test.ts`

- [ ] **Step 1: Write certificate number contract test**

Create `tests/unit/certificate-numbers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCertificateNumber } from "@/lib/certificates/numbers";

describe("formatCertificateNumber", () => {
  it("formats donation certificate numbers", () => {
    expect(formatCertificateNumber("donation", 2026, 1)).toBe("TFD-2026-D-000001");
  });

  it("formats honor certificate numbers", () => {
    expect(formatCertificateNumber("honor", 2026, 42)).toBe("TFD-2026-H-000042");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/certificate-numbers.test.ts
```

Expected: FAIL because `src/lib/certificates/numbers.ts` does not exist.

- [ ] **Step 3: Add certificate number formatter**

Create `src/lib/certificates/numbers.ts`:

```ts
export type CertificateType = "donation" | "honor";

const typeCode: Record<CertificateType, string> = {
  donation: "D",
  honor: "H",
};

export function formatCertificateNumber(type: CertificateType, year: number, sequence: number) {
  return `TFD-${year}-${typeCode[type]}-${String(sequence).padStart(6, "0")}`;
}
```

- [ ] **Step 4: Add database schema**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
create type donation_provider as enum ('stripe', 'paypal', 'manual');
create type donation_status as enum ('pending', 'paid', 'cancelled', 'failed', 'refunded');
create type certificate_type as enum ('donation', 'honor');
create type certificate_status as enum ('active', 'revoked', 'generation_failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'zh-Hant', 'ja', 'ko')),
  public_supporter_enabled boolean not null default false,
  public_display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.donation_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null,
  amount integer not null check (amount > 0),
  currency text not null default 'usd',
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sponsor_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  minimum_total_amount integer not null check (minimum_total_amount >= 0),
  currency text not null default 'usd',
  sort_order integer not null,
  is_active boolean not null default true
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid references public.donation_tiers(id),
  amount integer not null check (amount > 0),
  currency text not null default 'usd',
  provider donation_provider not null,
  provider_transaction_id text not null,
  status donation_status not null default 'pending',
  paid_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create sequence public.donation_certificate_seq;
create sequence public.honor_certificate_seq;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete cascade,
  sponsor_level_id uuid references public.sponsor_levels(id),
  type certificate_type not null,
  status certificate_status not null default 'active',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  render_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'donation' and donation_id is not null)
    or
    (type = 'honor' and sponsor_level_id is not null)
  )
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid not null,
  before jsonb,
  after jsonb,
  reason text not null,
  created_at timestamptz not null default now()
);

insert into public.donation_tiers (code, label, description, amount, currency, sort_order) values
  ('monthly', 'Monthly Support', 'One-time support equal to a monthly contribution.', 500, 'usd', 1),
  ('quarterly', 'Quarterly Support', 'One-time support equal to a quarterly contribution.', 1500, 'usd', 2),
  ('yearly', 'Yearly Support', 'One-time support equal to a yearly contribution.', 5000, 'usd', 3);

insert into public.sponsor_levels (code, label, minimum_total_amount, currency, sort_order) values
  ('bronze', 'Bronze', 500, 'usd', 1),
  ('silver', 'Silver', 5000, 'usd', 2),
  ('gold', 'Gold', 15000, 'usd', 3),
  ('platinum', 'Platinum', 50000, 'usd', 4);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.donation_tiers enable row level security;
alter table public.sponsor_levels enable row level security;
alter table public.donations enable row level security;
alter table public.certificates enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = false);
create policy "tiers_public_read" on public.donation_tiers for select using (is_active = true);
create policy "levels_public_read" on public.sponsor_levels for select using (is_active = true);
create policy "donations_select_own_or_admin" on public.donations for select using (user_id = auth.uid() or public.is_admin());
create policy "certificates_select_own_or_admin" on public.certificates for select using (user_id = auth.uid() or public.is_admin());
create policy "audit_admin_read" on public.admin_audit_logs for select using (public.is_admin());
```

- [ ] **Step 5: Create temporary database types**

Create `src/lib/database.types.ts` with this minimal type until generated Supabase types replace it:

```ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; email: string; is_admin: boolean } };
      donations: { Row: { id: string; user_id: string; amount: number; currency: string; status: string } };
      certificates: { Row: { id: string; certificate_number: string; user_id: string; type: "donation" | "honor"; status: string } };
    };
  };
};
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/unit/certificate-numbers.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase src/lib tests/unit/certificate-numbers.test.ts
git commit -m "feat: add supabase schema and certificate numbering"
```

---

### Task 4: Add Auth Clients and Login Guard

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/auth/guards.ts`
- Create: `src/app/[locale]/login/page.tsx`
- Test: `tests/unit/auth-guards.test.ts`

- [ ] **Step 1: Write guard tests**

Create `tests/unit/auth-guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getLoginRedirectPath, isAdminProfile } from "@/lib/auth/guards";

describe("auth guards", () => {
  it("builds locale-aware login redirects", () => {
    expect(getLoginRedirectPath("ja", "/ja/donate?tier=yearly")).toBe(
      "/ja/login?next=%2Fja%2Fdonate%3Ftier%3Dyearly",
    );
  });

  it("recognizes admin profiles", () => {
    expect(isAdminProfile({ is_admin: true })).toBe(true);
    expect(isAdminProfile({ is_admin: false })).toBe(false);
    expect(isAdminProfile(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/auth-guards.test.ts
```

Expected: FAIL because `src/lib/auth/guards.ts` does not exist.

- [ ] **Step 3: Add Supabase helpers**

Create `src/lib/supabase/server.ts`:

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
```

Create `src/lib/supabase/client.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: Add guard helpers**

Create `src/lib/auth/guards.ts`:

```ts
import { redirect } from "next/navigation";
import type { Locale } from "@/config/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminLike = { is_admin: boolean } | null;

export function getLoginRedirectPath(locale: Locale | string, nextPath: string) {
  return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
}

export function isAdminProfile(profile: AdminLike) {
  return profile?.is_admin === true;
}

export async function requireUser(locale: Locale | string, nextPath: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(getLoginRedirectPath(locale, nextPath));
  }

  return data.user;
}

export async function requireAdmin(locale: Locale | string) {
  const user = await requireUser(locale, `/${locale}/admin`);
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!isAdminProfile(profile)) {
    redirect(`/${locale}/dashboard`);
  }

  return user;
}
```

- [ ] **Step 5: Add minimal login page**

Create `src/app/[locale]/login/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const t = await getTranslations("nav");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">{t("signIn")}</h1>
      <p className="mt-3 text-sm text-slate-600">
        Sign in with email magic link, Google, GitHub, or Apple to continue.
      </p>
      <div className="mt-8 rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
        Sign-in methods are configured through Supabase Auth.
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/unit/auth-guards.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase src/lib/auth src/app/[locale]/login tests/unit/auth-guards.test.ts
git commit -m "feat: add auth clients and guards"
```

---

### Task 5: Build Public Download and Donation Pages

**Files:**
- Create: `src/app/[locale]/layout.tsx`
- Create: `src/app/[locale]/page.tsx`
- Create: `src/app/[locale]/donate/page.tsx`
- Create: `src/components/site-header.tsx`
- Create: `src/components/donation-tier-card.tsx`
- Test: `tests/e2e/public-download.spec.ts`

- [ ] **Step 1: Write public download E2E test**

Create `tests/e2e/public-download.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("anonymous visitor can see public download buttons", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Three Friends" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for macOS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for Windows" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for Linux" })).toBeVisible();
  await expect(page.getByText("Downloads are free. Donations support ongoing development.")).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test to verify it fails**

Run:

```bash
npm run e2e -- tests/e2e/public-download.spec.ts
```

Expected: FAIL because localized pages are not implemented.

- [ ] **Step 3: Add localized layout**

Create `src/app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import "../globals.css";

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 4: Add header component**

Create `src/components/site-header.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="border-b border-slate-200">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold">Three Friends</Link>
        <div className="flex items-center gap-5 text-sm text-slate-700">
          <Link href="/">{t("download")}</Link>
          <Link href="/donate">{t("donate")}</Link>
          <Link href="/sponsors">{t("sponsors")}</Link>
          <Link href="/dashboard">{t("dashboard")}</Link>
          <Link href="/login">{t("signIn")}</Link>
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 5: Add home page**

Create `src/app/[locale]/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { Link } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="max-w-3xl">
          <h1 className="text-5xl font-semibold tracking-normal text-slate-950">{t("title")}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-slate-950 px-5 py-3 text-sm font-medium text-white" href={siteConfig.downloadLinks.macos}>
              {t("downloadMac")}
            </a>
            <a className="rounded-md border border-slate-300 px-5 py-3 text-sm font-medium" href={siteConfig.downloadLinks.windows}>
              {t("downloadWindows")}
            </a>
            <a className="rounded-md border border-slate-300 px-5 py-3 text-sm font-medium" href={siteConfig.downloadLinks.linux}>
              {t("downloadLinux")}
            </a>
          </div>
          <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {t("supportPrompt")} <Link className="font-medium underline" href="/donate">Donate</Link>
          </div>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 6: Add donation card component and page**

Create `src/components/donation-tier-card.tsx`:

```tsx
import type { donationTiers } from "@/config/site";

type Tier = (typeof donationTiers)[number];

export function DonationTierCard({ tier, label }: { tier: Tier; label: string }) {
  const dollars = new Intl.NumberFormat("en", { style: "currency", currency: tier.currency }).format(tier.amount / 100);

  return (
    <article className="rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="mt-3 text-3xl font-semibold">{dollars}</p>
      <p className="mt-3 text-sm text-slate-600">One-time donation. No automatic renewal.</p>
      <div className="mt-6 grid gap-2">
        <form action="/api/checkout/stripe" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <button className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">
            Pay with Stripe
          </button>
        </form>
        <form action="/api/checkout/paypal" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <button className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" type="submit">
            Pay with PayPal
          </button>
        </form>
      </div>
    </article>
  );
}
```

Create `src/app/[locale]/donate/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { donationTiers } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { DonationTierCard } from "@/components/donation-tier-card";
import { SiteHeader } from "@/components/site-header";

export default async function DonatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireUser(locale, `/${locale}/donate`);
  const t = await getTranslations("donate");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t("subtitle")}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {donationTiers.map((tier) => (
            <DonationTierCard key={tier.code} tier={tier} label={t(`tiers.${tier.code}`)} />
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Run E2E test**

Run:

```bash
npm run e2e -- tests/e2e/public-download.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components tests/e2e/public-download.spec.ts
git commit -m "feat: build public download and donation pages"
```

---

### Task 6: Implement Sponsor Level Logic

**Files:**
- Create: `src/lib/certificates/levels.ts`
- Test: `tests/unit/sponsor-levels.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/sponsor-levels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getSponsorLevelForTotal } from "@/lib/certificates/levels";

describe("getSponsorLevelForTotal", () => {
  it("returns null below the first threshold", () => {
    expect(getSponsorLevelForTotal(499)?.code ?? null).toBeNull();
  });

  it("returns the highest level reached", () => {
    expect(getSponsorLevelForTotal(500)?.code).toBe("bronze");
    expect(getSponsorLevelForTotal(9000)?.code).toBe("silver");
    expect(getSponsorLevelForTotal(50000)?.code).toBe("platinum");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/sponsor-levels.test.ts
```

Expected: FAIL because `levels.ts` does not exist.

- [ ] **Step 3: Add sponsor level logic**

Create `src/lib/certificates/levels.ts`:

```ts
import { sponsorLevels } from "@/config/site";

export function getSponsorLevelForTotal(totalAmount: number) {
  return [...sponsorLevels]
    .sort((a, b) => b.minimumAmount - a.minimumAmount)
    .find((level) => totalAmount >= level.minimumAmount) ?? null;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/unit/sponsor-levels.test.ts tests/unit/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/certificates/levels.ts tests/unit/sponsor-levels.test.ts
git commit -m "feat: add sponsor level calculation"
```

---

### Task 7: Implement Stripe Checkout and Webhook

**Files:**
- Create: `src/lib/payments/tier.ts`
- Create: `src/lib/payments/stripe.ts`
- Create: `src/app/api/checkout/stripe/route.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`
- Test: `tests/unit/payment-tier.test.ts`

- [ ] **Step 1: Write tier lookup tests**

Create `tests/unit/payment-tier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findDonationTier } from "@/lib/payments/tier";

describe("findDonationTier", () => {
  it("returns a tier by code", () => {
    expect(findDonationTier("yearly")?.amount).toBe(5000);
  });

  it("returns null for invalid tier codes", () => {
    expect(findDonationTier("lifetime")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/payment-tier.test.ts
```

Expected: FAIL because `src/lib/payments/tier.ts` does not exist.

- [ ] **Step 3: Add tier lookup helper**

Create `src/lib/payments/tier.ts`:

```ts
import { donationTiers } from "@/config/site";

export function findDonationTier(code: FormDataEntryValue | string | null) {
  if (typeof code !== "string") {
    return null;
  }

  return donationTiers.find((tier) => tier.code === code) ?? null;
}
```

- [ ] **Step 4: Add Stripe helper**

Create `src/lib/payments/stripe.ts`:

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
});

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!;
}
```

- [ ] **Step 5: Add Stripe checkout route**

Create `src/app/api/checkout/stripe/route.ts`:

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { findDonationTier } from "@/lib/payments/tier";
import { stripe } from "@/lib/payments/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const tier = findDonationTier(formData.get("tier"));
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL!;

  if (!tier) {
    return NextResponse.json({ error: "Invalid donation tier" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.redirect(`${origin}/en/login?next=${encodeURIComponent("/en/donate")}`, 303);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: tier.currency,
          unit_amount: tier.amount,
          product_data: { name: `Three Friends ${tier.code} support` },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/en/dashboard?payment=stripe-success`,
    cancel_url: `${origin}/en/donate?payment=cancelled`,
    metadata: {
      user_id: data.user.id,
      tier: tier.code,
      amount: String(tier.amount),
      currency: tier.currency,
    },
  });

  return NextResponse.redirect(session.url!, 303);
}
```

- [ ] **Step 6: Add Stripe webhook route**

Create `src/app/api/webhooks/stripe/route.ts`:

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, getStripeWebhookSecret } from "@/lib/payments/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());

	  if (event.type === "checkout.session.completed") {
	    const session = event.data.object;
	    const userId = session.metadata?.user_id;
	    const tier = session.metadata?.tier;
	    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
	
	    if (!userId || !tier || !paymentIntent) {
	      return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
	    }
	  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- tests/unit/payment-tier.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/payments src/app/api/checkout/stripe src/app/api/webhooks/stripe tests/unit/payment-tier.test.ts
git commit -m "feat: add stripe checkout route"
```

---

### Task 8: Implement PayPal Checkout and Webhook

**Files:**
- Create: `src/lib/payments/paypal.ts`
- Create: `src/app/api/checkout/paypal/route.ts`
- Create: `src/app/api/webhooks/paypal/route.ts`

- [ ] **Step 1: Add PayPal helper**

Create `src/lib/payments/paypal.ts`:

```ts
type PayPalOrderInput = {
  amount: number;
  currency: string;
  userId: string;
  tierCode: string;
  returnUrl: string;
  cancelUrl: string;
};

export function getPayPalConfig() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    webhookId: process.env.PAYPAL_WEBHOOK_ID!,
    baseUrl: process.env.PAYPAL_BASE_URL ?? "https://api-m.paypal.com",
  };
}

export async function getPayPalAccessToken() {
  const config = getPayPalConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Unable to create PayPal access token");
  }

  const payload = await response.json() as { access_token: string };
  return payload.access_token;
}

export async function createPayPalOrder(input: PayPalOrderInput) {
  const config = getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: JSON.stringify({ userId: input.userId, tierCode: input.tierCode }),
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: (input.amount / 100).toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to create PayPal order");
  }

  return await response.json() as { id: string; links: Array<{ href: string; rel: string }> };
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const config = getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${config.baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: config.webhookId,
      webhook_event: event,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json() as { verification_status: string };
  return payload.verification_status === "SUCCESS";
}
```

- [ ] **Step 2: Add PayPal checkout route**

Create `src/app/api/checkout/paypal/route.ts`:

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { findDonationTier } from "@/lib/payments/tier";
import { createPayPalOrder } from "@/lib/payments/paypal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const tier = findDonationTier(formData.get("tier"));
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL!;

  if (!tier) {
    return NextResponse.json({ error: "Invalid donation tier" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.redirect(`${origin}/en/login?next=${encodeURIComponent("/en/donate")}`, 303);
  }

  const order = await createPayPalOrder({
    amount: tier.amount,
    currency: tier.currency,
    userId: data.user.id,
    tierCode: tier.code,
    returnUrl: `${origin}/en/dashboard?payment=paypal-success`,
    cancelUrl: `${origin}/en/donate?payment=cancelled`,
  });
  const approval = order.links.find((link) => link.rel === "approve");

  if (!approval) {
    return NextResponse.json({ error: "Missing PayPal approval URL" }, { status: 502 });
  }

  return NextResponse.redirect(approval.href, 303);
}
```

- [ ] **Step 3: Add PayPal webhook route**

Create `src/app/api/webhooks/paypal/route.ts`:

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyPayPalWebhook } from "@/lib/payments/paypal";

export async function POST(request: Request) {
  const event = await request.json();
  const verified = await verifyPayPalWebhook(await headers(), event);

  if (!verified) {
    return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 400 });
  }

  if (event.event_type === "CHECKOUT.ORDER.APPROVED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const resource = event.resource as { id?: string; custom_id?: string };
    const customId = resource.custom_id ? JSON.parse(resource.custom_id) as { userId?: string; tierCode?: string } : {};

    if (!resource.id || !customId.userId || !customId.tierCode) {
      return NextResponse.json({ error: "Missing PayPal donation metadata" }, { status: 400 });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Run lint and tests**

Run:

```bash
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payments/paypal.ts src/app/api/checkout/paypal src/app/api/webhooks/paypal
git commit -m "feat: add paypal checkout route"
```

---

### Task 9: Implement Donation Persistence and Certificate Generation Service

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/donations/record.ts`
- Create: `src/lib/certificates/service.ts`
- Create: `supabase/migrations/0002_certificate_functions.sql`
- Test: `tests/unit/donation-record.test.ts`

- [ ] **Step 1: Write donation normalization tests**

Create `tests/unit/donation-record.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDonationRecord } from "@/lib/donations/record";

describe("buildDonationRecord", () => {
  it("creates a paid donation record from provider data", () => {
    expect(buildDonationRecord({
      userId: "user_123",
      tierCode: "monthly",
      amount: 500,
      currency: "usd",
      provider: "stripe",
      providerTransactionId: "pi_123",
    })).toMatchObject({
      user_id: "user_123",
      amount: 500,
      currency: "usd",
      provider: "stripe",
      provider_transaction_id: "pi_123",
      status: "paid",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/donation-record.test.ts
```

Expected: FAIL because `record.ts` does not exist.

- [ ] **Step 3: Add admin Supabase client**

Create `src/lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
```

- [ ] **Step 4: Add donation record builder**

Create `src/lib/donations/record.ts`:

```ts
type Provider = "stripe" | "paypal" | "manual";

export type ProviderDonationInput = {
  userId: string;
  tierCode: string;
  amount: number;
  currency: string;
  provider: Provider;
  providerTransactionId: string;
};

export function buildDonationRecord(input: ProviderDonationInput) {
  return {
    user_id: input.userId,
    amount: input.amount,
    currency: input.currency,
    provider: input.provider,
    provider_transaction_id: input.providerTransactionId,
    status: "paid",
    paid_at: new Date().toISOString(),
    metadata: { tier: input.tierCode },
  };
}
```

- [ ] **Step 5: Add certificate SQL functions**

Create `supabase/migrations/0002_certificate_functions.sql`:

```sql
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
```

- [ ] **Step 6: Add certificate service**

Create `src/lib/certificates/service.ts`:

```ts
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSponsorLevelForTotal } from "@/lib/certificates/levels";
import { formatCertificateNumber, type CertificateType } from "@/lib/certificates/numbers";

export function buildCertificateNumber(type: CertificateType, sequence: number, issuedAt = new Date()) {
  return formatCertificateNumber(type, issuedAt.getUTCFullYear(), sequence);
}

export async function generateCertificatesForDonation(donationId: string) {
  const supabase = createSupabaseAdminClient() as any;
  const { data: donation, error: donationError } = await supabase
    .from("donations")
    .select("*")
    .eq("id", donationId)
    .eq("status", "paid")
    .single();

  if (donationError || !donation) {
    throw new Error(`Paid donation not found: ${donationId}`);
  }

  const { data: existingDonationCertificate } = await supabase
    .from("certificates")
    .select("id")
    .eq("donation_id", donationId)
    .eq("type", "donation")
    .maybeSingle();

  if (!existingDonationCertificate) {
    const { data: donationNumber, error: numberError } = await supabase.rpc("allocate_certificate_number", {
      input_type: "donation",
    });

    if (numberError || !donationNumber) {
      throw new Error("Unable to allocate donation certificate number");
    }

    const { error: insertDonationCertificateError } = await supabase.from("certificates").insert({
      certificate_number: donationNumber,
      user_id: donation.user_id,
      donation_id: donation.id,
      type: "donation",
      status: "active",
    });

    if (insertDonationCertificateError) {
      throw new Error("Unable to create donation certificate");
    }
  }

  const { data: totalAmount, error: totalError } = await supabase.rpc("get_paid_total", {
    input_user_id: donation.user_id,
  });

  if (totalError) {
    throw new Error("Unable to calculate paid donation total");
  }

  const level = getSponsorLevelForTotal(totalAmount ?? 0);
  if (!level) {
    return { donationId, honorCertificateCreated: false };
  }

  const { data: sponsorLevel, error: sponsorLevelError } = await supabase
    .from("sponsor_levels")
    .select("id")
    .eq("code", level.code)
    .single();

  if (sponsorLevelError || !sponsorLevel) {
    throw new Error(`Sponsor level not found: ${level.code}`);
  }

  const { data: existingHonorCertificate } = await supabase
    .from("certificates")
    .select("id")
    .eq("user_id", donation.user_id)
    .eq("sponsor_level_id", sponsorLevel.id)
    .eq("type", "honor")
    .maybeSingle();

  if (existingHonorCertificate) {
    return { donationId, honorCertificateCreated: false };
  }

  const { data: honorNumber, error: honorNumberError } = await supabase.rpc("allocate_certificate_number", {
    input_type: "honor",
  });

  if (honorNumberError || !honorNumber) {
    throw new Error("Unable to allocate honor certificate number");
  }

  const { error: insertHonorCertificateError } = await supabase.from("certificates").insert({
    certificate_number: honorNumber,
    user_id: donation.user_id,
    sponsor_level_id: sponsorLevel.id,
    type: "honor",
    status: "active",
  });

  if (insertHonorCertificateError) {
    throw new Error("Unable to create honor certificate");
  }

  return { donationId, honorCertificateCreated: true };
}
```

- [ ] **Step 7: Replace Stripe webhook with persistent implementation**

Replace `src/app/api/webhooks/stripe/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { buildDonationRecord } from "@/lib/donations/record";
import { generateCertificatesForDonation } from "@/lib/certificates/service";
import { stripe, getStripeWebhookSecret } from "@/lib/payments/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const userId = session.metadata?.user_id;
    const tierCode = session.metadata?.tier;
    const amount = Number(session.metadata?.amount);
    const currency = session.metadata?.currency ?? "usd";

    if (!paymentIntent || !userId || !tierCode || !amount) {
      return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const record = buildDonationRecord({
      userId,
      tierCode,
      amount,
      currency,
      provider: "stripe",
      providerTransactionId: paymentIntent,
    });
    const { data: donation, error } = await (supabase as any)
      .from("donations")
      .upsert(record, { onConflict: "provider,provider_transaction_id" })
      .select("id")
      .single();

    if (error || !donation) {
      return NextResponse.json({ error: "Unable to save donation" }, { status: 500 });
    }

    await generateCertificatesForDonation(donation.id);
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm test -- tests/unit/donation-record.test.ts tests/unit/certificate-numbers.test.ts tests/unit/sponsor-levels.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0002_certificate_functions.sql src/lib/supabase/admin.ts src/lib/donations src/lib/certificates src/app/api/webhooks/stripe tests/unit/donation-record.test.ts
git commit -m "feat: add donation persistence and certificate service"
```

---

### Task 10: Build Dashboard and Certificate Detail

**Files:**
- Create: `src/app/[locale]/dashboard/page.tsx`
- Create: `src/app/[locale]/dashboard/certificates/[id]/page.tsx`
- Create: `src/lib/certificates/render.tsx`
- Test: `tests/e2e/donation-auth.spec.ts`

- [ ] **Step 1: Write auth guard E2E test**

Create `tests/e2e/donation-auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("anonymous donation page redirects to login", async ({ page }) => {
  await page.goto("/en/donate");
  await expect(page).toHaveURL(/\/en\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test**

Run:

```bash
npm run e2e -- tests/e2e/donation-auth.spec.ts
```

Expected: PASS after Task 5 donation guard is active.

- [ ] **Step 3: Add certificate renderer**

Create `src/lib/certificates/render.tsx`:

```tsx
export function CertificateView({
  certificateNumber,
  recipientName,
  label,
  issuedAt,
}: {
  certificateNumber: string;
  recipientName: string;
  label: string;
  issuedAt: string;
}) {
  return (
    <section className="aspect-[1.414/1] rounded-lg border border-slate-300 bg-white p-10 text-center shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Certificate of Support</p>
      <h1 className="mt-8 text-4xl font-semibold text-slate-950">Three Friends</h1>
      <p className="mt-8 text-slate-600">Presented to</p>
      <p className="mt-3 text-3xl font-semibold">{recipientName}</p>
      <p className="mx-auto mt-6 max-w-xl text-slate-600">{label}</p>
      <div className="mt-10 flex items-center justify-between text-sm text-slate-500">
        <span>{certificateNumber}</span>
        <span>{issuedAt}</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add dashboard page**

Create `src/app/[locale]/dashboard/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale, `/${locale}/dashboard`);
  const t = await getTranslations("dashboard");
  const supabase = await createSupabaseServerClient();
  const { data: donations } = await supabase.from("donations").select("*").eq("user_id", user.id);
  const { data: certificates } = await supabase.from("certificates").select("*").eq("user_id", user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold">{t("donations")}</h2>
            <p className="mt-3 text-sm text-slate-600">{donations?.length ?? 0} donation records</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold">{t("certificates")}</h2>
            <p className="mt-3 text-sm text-slate-600">{certificates?.length ?? 0} certificates</p>
          </div>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Add certificate detail page**

Create `src/app/[locale]/dashboard/certificates/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CertificateView } from "@/lib/certificates/render";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await requireUser(locale, `/${locale}/dashboard/certificates/${id}`);
  const supabase = await createSupabaseServerClient();
  const { data: certificate } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!certificate) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <CertificateView
        certificateNumber={certificate.certificate_number}
        recipientName={user.email ?? "Supporter"}
        label={certificate.type === "donation" ? "Thank you for supporting development." : "Cumulative supporter recognition."}
        issuedAt={new Date(certificate.issued_at).toLocaleDateString("en")}
      />
    </main>
  );
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run e2e -- tests/e2e/donation-auth.spec.ts
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/dashboard src/lib/certificates/render.tsx tests/e2e/donation-auth.spec.ts
git commit -m "feat: add dashboard and certificates"
```

---

### Task 11: Build Lightweight Admin Pages

**Files:**
- Create: `src/app/[locale]/admin/page.tsx`
- Create: `src/app/[locale]/admin/donations/page.tsx`
- Create: `src/app/[locale]/admin/certificates/page.tsx`

- [ ] **Step 1: Add admin overview page**

Create `src/app/[locale]/admin/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { SiteHeader } from "@/components/site-header";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin(locale);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <a className="rounded-lg border border-slate-200 p-6" href={`/${locale}/admin/donations`}>Donations</a>
          <a className="rounded-lg border border-slate-200 p-6" href={`/${locale}/admin/certificates`}>Certificates</a>
          <a className="rounded-lg border border-slate-200 p-6" href={`/${locale}/admin/audit-logs`}>Audit Logs</a>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Add admin donations page**

Create `src/app/[locale]/admin/donations/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDonationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const { data: donations } = await supabase.from("donations").select("*").order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Donations</h1>
      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {(donations ?? []).map((donation) => (
          <div className="grid grid-cols-4 gap-4 p-4 text-sm" key={donation.id}>
            <span>{donation.provider}</span>
            <span>{donation.status}</span>
            <span>{donation.amount / 100} {donation.currency.toUpperCase()}</span>
            <span>{donation.provider_transaction_id}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add admin certificates page**

Create `src/app/[locale]/admin/certificates/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminCertificatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const { data: certificates } = await supabase.from("certificates").select("*").order("issued_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Certificates</h1>
      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {(certificates ?? []).map((certificate) => (
          <div className="grid grid-cols-4 gap-4 p-4 text-sm" key={certificate.id}>
            <span>{certificate.certificate_number}</span>
            <span>{certificate.type}</span>
            <span>{certificate.status}</span>
            <span>{certificate.issued_at}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/admin
git commit -m "feat: add admin dashboard"
```

---

### Task 12: Add Environment Template and Deployment Notes

**Files:**
- Create: `.env.example`
- Create: `docs/deployment.md`
- Modify: `README.md`

- [ ] **Step 1: Add environment example**

Create `.env.example`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

- [ ] **Step 2: Add deployment guide**

Create `docs/deployment.md`:

```md
# Deployment

## Services

- Vercel hosts the Next.js app.
- Supabase provides Auth and Postgres.
- Stripe handles card checkout.
- PayPal handles PayPal checkout.
- GitHub Releases hosts public software downloads.

## Setup Order

1. Create the Supabase project.
2. Run SQL migrations from `supabase/migrations`.
3. Configure Supabase Auth providers: email magic link, Google, GitHub, Apple.
4. Create Stripe products through checkout session code and set the webhook URL to `/api/webhooks/stripe`.
5. Create PayPal app credentials and set the webhook URL to `/api/webhooks/paypal`.
6. Create the Vercel project and add all variables from `.env.example`.
7. Point the domain DNS to Vercel.
8. Run a test donation through Stripe sandbox and PayPal sandbox.

## Security Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client components.
- Never expose payment webhook secrets in the browser.
- Keep public downloads separate from paid access logic.
```

- [ ] **Step 3: Add README**

Create or replace `README.md`:

```md
# Three Friends Website

International software download and voluntary donation website.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm test
npm run e2e
```

## Architecture

- Next.js App Router
- Supabase Auth and Postgres
- Stripe and PayPal one-time checkout
- next-intl locale routes: `/en`, `/zh-Hant`, `/ja`, `/ko`

See `docs/superpowers/specs/2026-04-29-software-donation-website-design.md` for the approved design.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
npm run lint
npm test
npm run e2e
npm run build
```

Expected: all commands pass locally with configured test environment variables.

- [ ] **Step 5: Commit**

```bash
git add .env.example docs/deployment.md README.md
git commit -m "docs: add deployment instructions"
```

---

### Task 13: Implement Supabase Login UI and OAuth Callback

**Files:**
- Create: `src/app/[locale]/login/login-form.tsx`
- Create: `src/app/[locale]/login/actions.ts`
- Create: `src/app/auth/callback/route.ts`
- Modify: `src/app/[locale]/login/page.tsx`
- Test: `tests/unit/auth-redirect.test.ts`

- [ ] **Step 1: Write redirect sanitization test**

Create `tests/unit/auth-redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "@/lib/auth/guards";

describe("sanitizeNextPath", () => {
  it("allows local paths", () => {
    expect(sanitizeNextPath("/en/donate?tier=yearly")).toBe("/en/donate?tier=yearly");
  });

  it("blocks external redirects", () => {
    expect(sanitizeNextPath("https://evil.example")).toBe("/en/dashboard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/auth-redirect.test.ts
```

Expected: FAIL because `sanitizeNextPath` is not defined.

- [ ] **Step 3: Add redirect sanitizer**

Add this function to `src/lib/auth/guards.ts`:

```ts
export function sanitizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/en/dashboard";
  }

  return nextPath;
}
```

- [ ] **Step 4: Add login server actions**

Create `src/app/[locale]/login/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? "/en/dashboard"));
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL!;
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  redirect(`${next}?login=check-email`);
}

export async function signInWithProvider(formData: FormData) {
  const provider = String(formData.get("provider")) as "google" | "github" | "apple";
  const next = sanitizeNextPath(String(formData.get("next") ?? "/en/dashboard"));
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL!;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(`${next}?login=oauth-error`);
  }

  redirect(data.url);
}
```

- [ ] **Step 5: Add login form component**

Create `src/app/[locale]/login/login-form.tsx`:

```tsx
import { signInWithEmail, signInWithProvider } from "./actions";

export function LoginForm({ next }: { next: string }) {
  return (
    <div className="mt-8 space-y-4">
      <form action={signInWithEmail} className="rounded-lg border border-slate-200 p-4">
        <input type="hidden" name="next" value={next} />
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
          id="email"
          name="email"
          required
          type="email"
        />
        <button className="mt-4 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">
          Send magic link
        </button>
      </form>
      <div className="grid gap-2">
        {(["google", "github", "apple"] as const).map((provider) => (
          <form action={signInWithProvider} key={provider}>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="provider" value={provider} />
            <button className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium capitalize" type="submit">
              Continue with {provider}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Replace login page with form**

Replace `src/app/[locale]/login/page.tsx` with:

```tsx
import { getTranslations } from "next-intl/server";
import { sanitizeNextPath } from "@/lib/auth/guards";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("nav");
  const { next } = await searchParams;
  const safeNext = sanitizeNextPath(next ?? "/en/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">{t("signIn")}</h1>
      <p className="mt-3 text-sm text-slate-600">
        Sign in to donate, view your donation history, and manage certificates.
      </p>
      <LoginForm next={safeNext} />
    </main>
  );
}
```

- [ ] **Step 7: Add auth callback**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
```

- [ ] **Step 8: Run tests**

Run:

```bash
npm test -- tests/unit/auth-redirect.test.ts tests/unit/auth-guards.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth/guards.ts src/app/[locale]/login src/app/auth/callback tests/unit/auth-redirect.test.ts
git commit -m "feat: implement supabase login"
```

---

### Task 14: Implement Public Sponsor Wall and Profile Privacy

**Files:**
- Create: `src/app/[locale]/sponsors/page.tsx`
- Create: `src/app/[locale]/dashboard/profile/actions.ts`
- Create: `src/app/[locale]/dashboard/profile/page.tsx`
- Test: `tests/unit/public-supporter.test.ts`

- [ ] **Step 1: Write public supporter display test**

Create `tests/unit/public-supporter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPublicSupporterName } from "@/lib/sponsors/public-profile";

describe("getPublicSupporterName", () => {
  it("uses public display name when enabled", () => {
    expect(getPublicSupporterName({
      public_supporter_enabled: true,
      public_display_name: "A Friend",
      display_name: "Private Name",
      email: "user@example.com",
    })).toBe("A Friend");
  });

  it("returns null when public display is disabled", () => {
    expect(getPublicSupporterName({
      public_supporter_enabled: false,
      public_display_name: "A Friend",
      display_name: "Private Name",
      email: "user@example.com",
    })).toBeNull();
  });
});
```

- [ ] **Step 2: Add public profile helper**

Create `src/lib/sponsors/public-profile.ts`:

```ts
type Profile = {
  public_supporter_enabled: boolean;
  public_display_name: string | null;
  display_name: string | null;
  email: string;
};

export function getPublicSupporterName(profile: Profile) {
  if (!profile.public_supporter_enabled) {
    return null;
  }

  return profile.public_display_name || profile.display_name || "Supporter";
}
```

- [ ] **Step 3: Add sponsor wall**

Create `src/app/[locale]/sponsors/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SponsorsPage() {
  const t = await getTranslations("sponsors");
  const supabase = await createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, public_display_name, display_name, public_supporter_enabled")
    .eq("public_supporter_enabled", true)
    .limit(100);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(profiles ?? []).map((profile) => (
            <article className="rounded-lg border border-slate-200 p-5" key={profile.id}>
              <h2 className="font-medium">{profile.public_display_name || profile.display_name || "Supporter"}</h2>
              <p className="mt-2 text-sm text-slate-600">Thank you for supporting development.</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Add profile privacy action**

Create `src/app/[locale]/dashboard/profile/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePublicProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    throw new Error("Unauthorized");
  }

  await supabase
    .from("profiles")
    .update({
      public_supporter_enabled: formData.get("public_supporter_enabled") === "on",
      public_display_name: String(formData.get("public_display_name") ?? "").trim() || null,
    })
    .eq("id", data.user.id);

  revalidatePath("/en/dashboard/profile");
  revalidatePath("/en/sponsors");
}
```

- [ ] **Step 5: Add profile privacy page**

Create `src/app/[locale]/dashboard/profile/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updatePublicProfile } from "./actions";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale, `/${locale}/dashboard/profile`);
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Public supporter profile</h1>
      <form action={updatePublicProfile} className="mt-8 space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <input defaultChecked={profile?.public_supporter_enabled ?? false} name="public_supporter_enabled" type="checkbox" />
          Show me on the public supporter wall
        </label>
        <label className="block text-sm font-medium">
          Public display name
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={profile?.public_display_name ?? ""}
            name="public_display_name"
          />
        </label>
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">
          Save
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/unit/public-supporter.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sponsors src/app/[locale]/sponsors src/app/[locale]/dashboard/profile tests/unit/public-supporter.test.ts
git commit -m "feat: add sponsor wall and privacy controls"
```

---

### Task 15: Add Certificate PNG and PDF Export Endpoints

**Files:**
- Modify: `package.json`
- Create: `src/app/api/certificates/[id]/pdf/route.ts`
- Create: `src/app/api/certificates/[id]/png/route.ts`

- [ ] **Step 1: Install export dependencies**

Run:

```bash
npm install @react-pdf/renderer
```

Expected: certificate export dependencies are added to `package.json`.

- [ ] **Step 2: Add PDF route**

Create `src/app/api/certificates/[id]/pdf/route.ts`:

```ts
import React from "react";
import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica" },
  frame: { border: "1px solid #CBD5E1", padding: 40, height: "100%" },
  eyebrow: { fontSize: 10, color: "#64748B", textAlign: "center", textTransform: "uppercase" },
  title: { marginTop: 56, fontSize: 32, color: "#020617", textAlign: "center" },
  label: { marginTop: 40, fontSize: 14, color: "#475569", textAlign: "center" },
  number: { marginTop: 56, fontSize: 10, color: "#64748B", textAlign: "center" },
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("en", `/en/dashboard/certificates/${id}`);
  const supabase = await createSupabaseServerClient();
  const { data: certificate } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const pdf = await renderToBuffer(
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", orientation: "landscape", style: styles.page },
        React.createElement(
          View,
          { style: styles.frame },
          React.createElement(Text, { style: styles.eyebrow }, "Certificate of Support"),
          React.createElement(Text, { style: styles.title }, "Three Friends"),
          React.createElement(Text, { style: styles.label }, `Presented to ${user.email ?? "Supporter"}`),
          React.createElement(
            Text,
            { style: styles.label },
            certificate.type === "donation" ? "Thank you for supporting development." : "Cumulative supporter recognition.",
          ),
          React.createElement(Text, { style: styles.number }, certificate.certificate_number),
        ),
      ),
    ),
  );

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.certificate_number}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Add PNG route**

Create `src/app/api/certificates/[id]/png/route.ts`:

```ts
import React from "react";
import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("en", `/en/dashboard/certificates/${id}`);
  const supabase = await createSupabaseServerClient();
  const { data: certificate } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "1200px",
          height: "850px",
          background: "white",
          border: "2px solid #cbd5e1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial",
          color: "#020617",
        },
      },
      React.createElement(
        "div",
        { style: { fontSize: 18, letterSpacing: 4, color: "#64748b", textTransform: "uppercase" } },
        "Certificate of Support",
      ),
      React.createElement("div", { style: { marginTop: 72, fontSize: 64, fontWeight: 700 } }, "Three Friends"),
      React.createElement(
        "div",
        { style: { marginTop: 56, fontSize: 28, color: "#475569" } },
        `Presented to ${user.email ?? "Supporter"}`,
      ),
      React.createElement(
        "div",
        { style: { marginTop: 36, fontSize: 26, color: "#475569" } },
        certificate.type === "donation" ? "Thank you for supporting development." : "Cumulative supporter recognition.",
      ),
      React.createElement(
        "div",
        { style: { marginTop: 72, fontSize: 20, color: "#64748b" } },
        certificate.certificate_number,
      ),
    ),
    {
      width: 1200,
      height: 850,
    },
  );
}
```

- [ ] **Step 4: Add export links on certificate page**

Modify `src/app/[locale]/dashboard/certificates/[id]/page.tsx` and add links after `CertificateView`:

```tsx
<div className="mt-6 flex gap-3">
  <a className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href={`/api/certificates/${certificate.id}/pdf`}>
    Download PDF
  </a>
  <a className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium" href={`/api/certificates/${certificate.id}/png`}>
    Download PNG
  </a>
</div>
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/api/certificates src/app/[locale]/dashboard/certificates
git commit -m "feat: add certificate export endpoints"
```

---

### Task 16: Add Admin Corrections, Revocation, and Audit Logs

**Files:**
- Create: `src/app/[locale]/admin/actions.ts`
- Create: `src/app/[locale]/admin/audit-logs/page.tsx`
- Modify: `src/app/[locale]/admin/donations/page.tsx`
- Modify: `src/app/[locale]/admin/certificates/page.tsx`

- [ ] **Step 1: Add admin actions**

Create `src/app/[locale]/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function revokeCertificate(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  const certificateId = String(formData.get("certificate_id"));
  const reason = String(formData.get("reason") ?? "Admin revocation");
  const admin = await requireAdmin(locale);
  const supabase = createSupabaseAdminClient() as any;

  const { data: before } = await supabase.from("certificates").select("*").eq("id", certificateId).single();
  await supabase.from("certificates").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", certificateId);
  await supabase.from("admin_audit_logs").insert({
    admin_user_id: admin.id,
    action: "revoke_certificate",
    target_type: "certificate",
    target_id: certificateId,
    before,
    after: { status: "revoked" },
    reason,
  });

  revalidatePath(`/${locale}/admin/certificates`);
}

export async function addManualDonation(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  const admin = await requireAdmin(locale);
  const supabase = createSupabaseAdminClient() as any;
  const userId = String(formData.get("user_id"));
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "Manual donation entry");

  const { data: donation } = await supabase
    .from("donations")
    .insert({
      user_id: userId,
      amount,
      currency: "usd",
      provider: "manual",
      provider_transaction_id: `manual_${Date.now()}`,
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata: { reason },
    })
    .select("id")
    .single();

  await supabase.from("admin_audit_logs").insert({
    admin_user_id: admin.id,
    action: "add_manual_donation",
    target_type: "donation",
    target_id: donation.id,
    before: null,
    after: { user_id: userId, amount },
    reason,
  });

  revalidatePath(`/${locale}/admin/donations`);
}
```

- [ ] **Step 2: Add audit log page**

Create `src/app/[locale]/admin/audit-logs/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AuditLogsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const { data: logs } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Audit Logs</h1>
      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {(logs ?? []).map((log) => (
          <div className="grid grid-cols-4 gap-4 p-4 text-sm" key={log.id}>
            <span>{log.action}</span>
            <span>{log.target_type}</span>
            <span>{log.reason}</span>
            <span>{log.created_at}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Add manual donation form to donations page**

Modify `src/app/[locale]/admin/donations/page.tsx` and import `addManualDonation`:

```tsx
import { addManualDonation } from "../actions";
```

Add this form below the heading:

```tsx
<form action={addManualDonation} className="mt-6 grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-4">
  <input name="locale" type="hidden" value={locale} />
  <input className="rounded-md border border-slate-300 px-3 py-2" name="user_id" placeholder="User ID" required />
  <input className="rounded-md border border-slate-300 px-3 py-2" name="amount" placeholder="Amount in cents" required type="number" />
  <input className="rounded-md border border-slate-300 px-3 py-2" name="reason" placeholder="Reason" required />
  <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">Add manual donation</button>
</form>
```

- [ ] **Step 4: Add revocation form to certificates page**

Modify `src/app/[locale]/admin/certificates/page.tsx` and import `revokeCertificate`:

```tsx
import { revokeCertificate } from "../actions";
```

Inside each certificate row, add:

```tsx
<form action={revokeCertificate} className="flex gap-2">
  <input name="locale" type="hidden" value={locale} />
  <input name="certificate_id" type="hidden" value={certificate.id} />
  <input className="rounded-md border border-slate-300 px-2 py-1" name="reason" placeholder="Reason" required />
  <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" type="submit">Revoke</button>
</form>
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/admin
git commit -m "feat: add admin corrections and audit logs"
```

---

## Final Verification

After all tasks are complete, run:

```bash
git status --short
npm run lint
npm test
npm run e2e
npm run build
```

Expected:

- `git status --short` shows no uncommitted implementation changes.
- Lint passes.
- Unit tests pass.
- E2E tests pass.
- Production build passes.

Then start the development server:

```bash
npm run dev
```

Expected: the site is available at `http://localhost:3000/en`, with public downloads visible and donation requiring login.
