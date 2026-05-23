# Simplified Chinese Language Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Traditional Chinese with Simplified Chinese, make English the fallback language, and limit exposed languages to English and Chinese.

**Architecture:** Keep the existing next-intl architecture and shared `supportedLocales` source of truth. Rename the Chinese locale from `zh-Hant` to `zh`, keep `en` as the default locale and fallback source, and remove Japanese/Korean from public/admin switchers and static params.

**Tech Stack:** Next.js App Router, next-intl, TypeScript, Vitest, Playwright.

---

### Task 1: Locale Contract

**Files:**
- Modify: `src/config/site.ts`
- Modify: `src/components/language-switcher.tsx`
- Modify: `src/i18n/request.ts`
- Test: `tests/unit/config.test.ts`
- Test: `tests/unit/language-switcher.test.ts`
- Test: `tests/unit/action-locale.test.ts`
- Test: `tests/unit/page-locale.test.ts`

- [ ] **Step 1: Write failing tests for the new locale set**

Expect supported locales to be `["en", "zh"]`, the language switcher to expose only English and Simplified Chinese, and invalid action locales such as `ja`, `ko`, and `zh-Hant` to fall back to English.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/config.test.ts tests/unit/language-switcher.test.ts tests/unit/action-locale.test.ts tests/unit/page-locale.test.ts`

Expected: FAIL because the app still exposes `zh-Hant`, `ja`, and `ko`.

- [ ] **Step 3: Update locale source of truth**

Change `supportedLocales` to `["en", "zh"]`, update language labels to `EN` and `ZH`, and keep request fallback loading from `messages/en.json`.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/unit/config.test.ts tests/unit/language-switcher.test.ts tests/unit/action-locale.test.ts tests/unit/page-locale.test.ts`

Expected: PASS.

### Task 2: Message Files

**Files:**
- Rename: `messages/zh-Hant.json` to `messages/zh.json`
- Remove from active locale set: `messages/ja.json`, `messages/ko.json`
- Test: `tests/unit/i18n-config.test.ts`
- Test: `tests/unit/license-code-copy-integrity.test.ts`

- [ ] **Step 1: Write failing tests for message parity**

Expect only active locales `en` and `zh` to be checked. Verify the two message files have identical key paths and Chinese copy contains Simplified Chinese terms such as `兑换码`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/i18n-config.test.ts tests/unit/license-code-copy-integrity.test.ts`

Expected: FAIL because the Chinese file is still named `zh-Hant` and uses Traditional Chinese.

- [ ] **Step 3: Convert Chinese messages**

Rename `messages/zh-Hant.json` to `messages/zh.json` and convert Traditional Chinese text to Simplified Chinese. Leave English as the canonical fallback file.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/unit/i18n-config.test.ts tests/unit/license-code-copy-integrity.test.ts`

Expected: PASS.

### Task 3: Route And Admin Surface Cleanup

**Files:**
- Modify: route/static param tests that assert old locale paths
- Modify: admin action tests that use Japanese/Korean solely as locale examples
- Modify: `tests/e2e/home.spec.ts`
- Modify: `tests/e2e/versions-language.spec.ts`

- [ ] **Step 1: Write failing route/admin assertions**

Expect static pages to pre-render `en` and `zh` only, and admin/public language controls to stop offering `ja` and `ko`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/release-download-pages.test.tsx tests/unit/admin-actions.test.ts tests/unit/admin-license-actions.test.ts`

Expected: FAIL on old `zh-Hant`, `ja`, and `ko` expectations.

- [ ] **Step 3: Update tests and affected locale expectations**

Replace active Chinese route expectations with `/zh/...`. Replace Japanese/Korean test locales with `en` or `zh` where the test is not about unsupported locale behavior.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/unit/release-download-pages.test.tsx tests/unit/admin-actions.test.ts tests/unit/admin-license-actions.test.ts`

Expected: PASS.

### Task 4: Verification

**Files:**
- All changed files

- [ ] **Step 1: Scan for retired active locale references**

Run: `rg 'zh-Hant|日本語|한국어|\"ja\"|\"ko\"' src messages tests/e2e tests/unit`

Expected: no active UI/config references to retired locales; remaining tests may mention unsupported values only when explicitly testing fallback or sanitization.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 4: Browser QA with gstack/browser**

Run the dev server and inspect `/en`, `/zh`, and an admin page language switcher. Confirm the switcher displays only English and Chinese and Chinese pages render Simplified Chinese.
