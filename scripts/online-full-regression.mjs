import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.E2E_BASE_URL ?? "https://gitbookai.ccwu.cc";
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? "codex-e2e-owner-20260506@example.com";
const ownerPasswordPath = process.env.E2E_OWNER_PASSWORD_FILE ?? "/tmp/codex-e2e-password.txt";
const marker = `codex-full-${Date.now()}`;
const userEmail = process.env.E2E_USER_EMAIL ?? `${marker}@example.test`;
const userPasswordPath = process.env.E2E_USER_PASSWORD_FILE ?? "/tmp/codex-full-e2e-password.txt";
const staticUserId = process.env.E2E_USER_ID;

function readSecret(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing secret file: ${path}`);
  }

  return readFileSync(path, "utf8").trim();
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function query(sql) {
  const output = execFileSync("supabase", ["db", "query", sql, "--linked", "--output", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parsed = JSON.parse(output.slice(output.indexOf("{")));
  return parsed.rows ?? [];
}

function scalar(sql) {
  const rows = query(sql);
  if (rows.length === 0) {
    return null;
  }

  return Object.values(rows[0])[0];
}

function createAuthTestUser(email, password, displayName) {
  const id = staticUserId ?? randomUUID();
  query(`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ${sqlLiteral(id)},
      'authenticated',
      'authenticated',
      ${sqlLiteral(email)},
      crypt(${sqlLiteral(password)}, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', ${sqlLiteral(displayName)}, 'source', 'codex-online-regression'),
      now(),
      now(),
      false,
      false
    )
    on conflict (id) do update set
      email=excluded.email,
      encrypted_password=excluded.encrypted_password,
      updated_at=now(),
      deleted_at=null;

    insert into public.profiles (
      id,
      email,
      display_name,
      public_display_name,
      public_supporter_enabled,
      admin_role,
      account_status,
      is_admin,
      created_at,
      updated_at
    )
    values (
      ${sqlLiteral(id)},
      ${sqlLiteral(email)},
      ${sqlLiteral(displayName)},
      ${sqlLiteral(displayName)},
      true,
      'user',
      'active',
      false,
      now(),
      now()
    )
    on conflict (id) do update set
      email=excluded.email,
      display_name=excluded.display_name,
      public_display_name=excluded.public_display_name,
      public_supporter_enabled=true,
      admin_role='user',
      account_status='active',
      is_admin=false,
      updated_at=now();
  `);
  return id;
}

async function waitForPageSettled(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

async function goto(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await waitForPageSettled(page);
  await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
}

async function login(page, email, password, next = "/en/dashboard") {
  await goto(page, `/en/login?next=${encodeURIComponent(next)}`);
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await Promise.all([
    page.waitForURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 30000 }),
    page.getByRole("button", { name: "Sign in with email" }).click(),
  ]);
  await waitForPageSettled(page);
}

async function safeClick(page, locator) {
  await expect(locator).toBeVisible({ timeout: 10000 });
  await locator.click();
  await waitForPageSettled(page);
}

async function expectVisibleOrDump(page, locator, label) {
  try {
    await expect(locator).toBeVisible({ timeout: 10000 });
  } catch (error) {
    const statusText = await page.locator('[role="status"], [role="alert"]').allTextContents().catch(() => []);
    const headingText = await page.locator("h1,h2").allTextContents().catch(() => []);
    throw new Error(`${label} was not visible after navigation to ${page.url()}. Status text: ${statusText.join(" | ")}. Headings: ${headingText.join(" | ")}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function submitConfirm(page, locator) {
  await expect(locator).toBeVisible({ timeout: 10000 });
  await locator.click();
  await expect(page.getByText("Click again to confirm this action.")).toBeVisible({ timeout: 5000 });
  await locator.click();
  await waitForPageSettled(page);
}

async function fillByLabel(scope, label, value) {
  const field = scope.getByLabel(label).first();
  await expect(field).toBeVisible({ timeout: 10000 });
  await field.fill(value);
}

async function main() {
  const ownerPassword = readSecret(ownerPasswordPath);
  const userPassword = readSecret(userPasswordPath);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];
  const badResponses = [];
  context.on("page", (page) => {
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  const supportSubject = `${marker} support`;
  const supportUserReply = `${marker} user reply`;
  const supportAdminReply = `${marker} admin reply`;
  const notificationTitle = `${marker} notification`;
  const releaseVersion = `codex-${Date.now()}`;
  const licenseBatchLabel = `${marker} monthly license`;
  const profileName = `${marker} user`;
  const donationReference = `${marker}-manual-${randomUUID().slice(0, 8)}`;
  const userId = createAuthTestUser(userEmail, userPassword, profileName);

  await goto(page, "/en");
  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
  await goto(page, "/en/versions");
  await expect(page.getByRole("heading", { name: "Older versions" })).toBeVisible();
  await goto(page, "/en/contributions");
  await expect(page.getByRole("heading", { name: "Contribute to GitBook AI" })).toBeVisible();
  await goto(page, "/en/support");
  await expect(page.getByRole("heading", { name: "Help and feedback" })).toBeVisible();
  await goto(page, "/en/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

  await login(page, userEmail, userPassword);
  await expect(page.getByRole("heading", { name: "Personal center" })).toBeVisible();
  await fillByLabel(page, "Display name", profileName);
  await safeClick(page, page.getByRole("button", { name: "Save profile" }));
  await expect(page).toHaveURL(/profile=saved/);
  const updatedName = scalar(`select display_name from public.profiles where id=${sqlLiteral(userId)}`);
  expect(updatedName).toBe(profileName);

  await goto(page, "/en/support");
  await fillByLabel(page, "Preferred contact", `${marker}@example.test`);
  await fillByLabel(page, "Subject", supportSubject);
  await fillByLabel(page, "Message", `${marker} support message`);
  await safeClick(page, page.getByRole("button", { name: "Send feedback" }));
  await expect(page.getByText("Feedback sent. We will review it soon.")).toBeVisible();
  const feedbackId = scalar(`select id from public.support_feedback where subject=${sqlLiteral(supportSubject)} and user_id=${sqlLiteral(userId)} order by created_at desc limit 1`);
  expect(feedbackId).toBeTruthy();

  await safeClick(page, page.getByRole("link", { name: /View thread/ }).first());
  await expect(page.getByRole("heading", { name: supportSubject })).toBeVisible();
  await fillByLabel(page, "Reply", supportUserReply);
  await safeClick(page, page.getByRole("button", { name: "Send reply" }));
  await expect(page.getByText("Reply sent.")).toBeVisible();
  expect(Number(scalar(`select count(*) from public.support_feedback_messages where feedback_id=${sqlLiteral(feedbackId)} and author_role='user' and body=${sqlLiteral(supportUserReply)}`))).toBe(1);

  await context.clearCookies();
  await login(page, ownerEmail, ownerPassword, "/en/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();

  await goto(page, "/en/admin/notifications");
  await fillByLabel(page, "Title", notificationTitle);
  await fillByLabel(page, "Body", `${marker} notification body`);
  await page.getByLabel("Publish").check();
  await safeClick(page, page.getByRole("button", { name: "Create notification" }));
  await expect(page.getByText(notificationTitle).first()).toBeVisible();
  const notificationId = scalar(`select id from public.notifications where title=${sqlLiteral(notificationTitle)} and published_at is not null order by created_at desc limit 1`);
  expect(notificationId).toBeTruthy();

  await goto(page, "/en/admin/support-feedback");
  await safeClick(page, page.getByRole("link", { name: /Open thread/ }).first());
  await expect(page.getByRole("heading", { name: supportSubject })).toBeVisible();
  await fillByLabel(page, "Reply to user", supportAdminReply);
  await safeClick(page, page.getByRole("button", { name: "Send reply" }));
  expect(Number(scalar(`select count(*) from public.support_feedback_messages where feedback_id=${sqlLiteral(feedbackId)} and author_role='admin' and body=${sqlLiteral(supportAdminReply)}`))).toBe(1);

  await goto(page, "/en/admin/releases");
  await fillByLabel(page, "Version", releaseVersion);
  await fillByLabel(page, "Release date", "2026-05-06");
  await fillByLabel(page, "Release notes", `${marker} release notes`);
  await page.getByLabel("Use download links").check();
  await fillByLabel(page, "macOS primary URL", "https://example.com/codex-macos.dmg");
  await fillByLabel(page, "Windows primary URL", "https://example.com/codex-windows.exe");
  await page.getByLabel("Published").check();
  await safeClick(page, page.getByRole("button", { name: "Create release" }));
  await expect(page.getByText(releaseVersion).first()).toBeVisible();
  expect(scalar(`select is_published from public.software_releases where version=${sqlLiteral(releaseVersion)} limit 1`)).toBe(true);

  await goto(page, "/en/admin/licenses");
  await fillByLabel(page, "Batch name", licenseBatchLabel);
  await page.locator('select[name="duration_kind"]').selectOption("month_1");
  await fillByLabel(page, "Quantity", "1");
  await page.locator('form:has(input[name="label"]) select[name="channel_type"]').selectOption("partner");
  await safeClick(page, page.getByRole("button", { name: "Generate codes" }));
  const licenseBatchId = scalar(`select id from public.license_code_batches where label=${sqlLiteral(licenseBatchLabel)} order by created_at desc limit 1`);
  expect(licenseBatchId).toBeTruthy();
  const licenseId = scalar(`select id from public.trial_codes where batch_id=${sqlLiteral(licenseBatchId)} and duration_kind='month_1' and trial_days=30 order by created_at desc limit 1`);
  expect(licenseId).toBeTruthy();
  const licenseRow = page.getByRole("row").filter({ hasText: licenseBatchLabel }).last();
  await safeClick(page, licenseRow.getByRole("button", { name: "Reveal" }));
  const licenseCode = (await licenseRow.locator("code").innerText()).trim();
  expect(licenseCode).toMatch(/^1M/);

  await goto(page, "/en/admin/donations");
  await fillByLabel(page, "Email or user ID", userEmail);
  await fillByLabel(page, "Amount (cents)", "1234");
  await fillByLabel(page, "Reference", donationReference);
  await fillByLabel(page, "Reason", `${marker} verified manual contribution`);
  await submitConfirm(page, page.getByRole("button", { name: "Add manual contribution" }));
  const manualTransactionId = `manual_${donationReference}`;
  const donationId = scalar(`select id from public.donations where provider_transaction_id=${sqlLiteral(manualTransactionId)} limit 1`);
  expect(donationId).toBeTruthy();
  expect(Number(scalar(`select count(*) from public.certificates where donation_id=${sqlLiteral(donationId)}`))).toBeGreaterThan(0);
  const certificateNumber = scalar(`select certificate_number from public.certificates where donation_id=${sqlLiteral(donationId)} limit 1`);
  expect(certificateNumber).toBeTruthy();

  await goto(page, `/en/admin/users?query=${encodeURIComponent(userEmail)}`);
  const userCheckbox = page.getByLabel(`Select ${userEmail}`);
  await expect(userCheckbox).toBeVisible();
  await userCheckbox.check();
  await expect(page.getByText("1 selected")).toBeVisible();
  await safeClick(page, page.getByRole("button", { name: "Bulk disable" }));
  await expect(page).toHaveURL(/notice=bulk-user-status-updated/);
  expect(scalar(`select account_status from public.profiles where id=${sqlLiteral(userId)}`)).toBe("disabled");
  await userCheckbox.check();
  await safeClick(page, page.getByRole("button", { name: "Bulk enable" }));
  await expect(page).toHaveURL(/notice=bulk-user-status-updated/);
  expect(scalar(`select account_status from public.profiles where id=${sqlLiteral(userId)}`)).toBe("active");
  await userCheckbox.check();
  await page.locator("#bulk-users-bulk-action-form-admin-role").selectOption("operator");
  await safeClick(page, page.getByRole("button", { name: "Bulk change role" }));
  await expect(page).toHaveURL(/notice=bulk-user-role-updated/);
  expect(scalar(`select admin_role from public.profiles where id=${sqlLiteral(userId)}`)).toBe("operator");
  await userCheckbox.check();
  await page.locator("#bulk-users-bulk-action-form-admin-role").selectOption("user");
  await safeClick(page, page.getByRole("button", { name: "Bulk change role" }));
  await expect(page).toHaveURL(/notice=bulk-user-role-updated/);
  expect(scalar(`select admin_role from public.profiles where id=${sqlLiteral(userId)}`)).toBe("user");
  await safeClick(page, page.getByRole("link", { name: "Manage user" }).first());
  await expect(page.getByRole("heading", { name: "User operations" })).toBeVisible();

  await context.clearCookies();
  await login(page, userEmail, userPassword);
  await fillByLabel(page, "License code", licenseCode);
  await safeClick(page, page.getByRole("button", { name: "Redeem code" }));
  await expectVisibleOrDump(page, page.getByText("License code redeemed."), "License redemption success message");
  expect(Number(scalar(`select count(*) from public.trial_code_redemptions where trial_code_id=${sqlLiteral(licenseId)} and user_id=${sqlLiteral(userId)}`))).toBe(1);
  expect(String(scalar(`select status from public.license_entitlements where user_id=${sqlLiteral(userId)} and feature_code='cloud_sync' limit 1`))).toBe("active");
  await expect(page.getByText(certificateNumber).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View certificate" }).first()).toBeVisible();

  await goto(page, "/en/notifications");
  await expect(page.getByText(notificationTitle).first()).toBeVisible();
  await safeClick(page, page.getByRole("button", { name: "Mark as read" }).first());
  expect(Number(scalar(`select count(*) from public.notification_reads where notification_id=${sqlLiteral(notificationId)} and user_id=${sqlLiteral(userId)}`))).toBe(1);

  await goto(page, `/en/support/feedback/${feedbackId}`);
  await expect(page.getByText(supportAdminReply)).toBeVisible();

  await browser.close();

  if (pageErrors.length > 0 || badResponses.length > 0) {
    throw new Error(`Browser errors: ${pageErrors.join(" | ")}; bad responses: ${badResponses.join(" | ")}`);
  }

  console.log(JSON.stringify({
    baseUrl,
    donationReference,
    feedbackId,
    marker,
    notificationId,
    releaseVersion,
    licenseBatchId,
    licenseId,
    userEmail,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
