import { chromium, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.E2E_BASE_URL ?? "https://gitbookai.ccwu.cc";
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? "codex-e2e-owner-20260506@example.com";
const ownerPasswordPath = process.env.E2E_OWNER_PASSWORD_FILE ?? "/tmp/codex-e2e-password.txt";
const marker = `codex-full-${Date.now()}`;
const userEmail = process.env.E2E_USER_EMAIL ?? `${marker}@example.test`;
const userPasswordPath = process.env.E2E_USER_PASSWORD_FILE ?? "/tmp/codex-full-e2e-password.txt";
const staticUserId = process.env.E2E_USER_ID;

loadEnvFile(".env.codex-test");

const supabase = createClient(
  readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator);
    const rawValue = trimmed.slice(separator + 1);
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
    }
  }
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readSecret(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing secret file: ${path}`);
  }

  return readFileSync(path, "utf8").trim();
}

async function withDbRetries(label, action, { attempts = 3 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function maybeSingle(label, builder) {
  return withDbRetries(label, async () => {
    const { data, error } = await builder.maybeSingle();
    if (error) throw error;
    return data;
  });
}

async function exactCount(label, builder) {
  return withDbRetries(label, async () => {
    const { count, error } = await builder;
    if (error) throw error;
    return count ?? 0;
  });
}

async function waitForValue(label, action, { timeoutMs = 30000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let value = await action();

  while (!value && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    value = await action();
  }

  return value;
}

async function createAuthTestUser(email, password, displayName) {
  if (staticUserId) {
    throw new Error("E2E_USER_ID is not supported by the Supabase Admin API based online regression path.");
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: displayName, source: "codex-online-regression" },
  });

  if (error || !data.user) {
    throw error ?? new Error("Failed to create auth test user");
  }

  const id = data.user.id;

  await withDbRetries("upsert test profile", async () => {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id,
      email,
      display_name: displayName,
      public_display_name: displayName,
      public_supporter_enabled: true,
      admin_role: "user",
      account_status: "active",
      is_admin: false,
      updated_at: new Date().toISOString(),
    });

    if (profileError) throw profileError;
  });

  return id;
}

async function waitForPageSettled(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

async function withRetries(label, action, { attempts = 3 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function goto(page, path) {
  await withRetries(`goto ${path}`, async () => {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForPageSettled(page);
    await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
  });
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

async function findProfile(userId) {
  return maybeSingle("find profile", supabase.from("profiles").select("display_name,account_status,admin_role").eq("id", userId));
}

async function findFeedback(subject, userId) {
  return maybeSingle(
    "find support feedback",
    supabase.from("support_feedback").select("id").eq("subject", subject).eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
  );
}

async function countSupportMessages(feedbackId, authorRole, body) {
  return exactCount(
    "count support messages",
    supabase.from("support_feedback_messages").select("id", { count: "exact", head: true }).eq("feedback_id", feedbackId).eq("author_role", authorRole).eq("body", body),
  );
}

async function findNotification(title) {
  return maybeSingle(
    "find notification",
    supabase.from("notifications").select("id").eq("title", title).not("published_at", "is", null).order("created_at", { ascending: false }).limit(1),
  );
}

async function findRelease(version) {
  return maybeSingle("find release", supabase.from("software_releases").select("is_published").eq("version", version).limit(1));
}

async function findLicenseBatch(label) {
  return maybeSingle(
    "find license batch",
    supabase.from("license_code_batches").select("id").eq("label", label).order("created_at", { ascending: false }).limit(1),
  );
}

async function findTrialCode(batchId) {
  return maybeSingle(
    "find trial code",
    supabase.from("trial_codes").select("id").eq("batch_id", batchId).eq("duration_kind", "month_1").eq("trial_days", 30).order("created_at", { ascending: false }).limit(1),
  );
}

async function findDonation(providerTransactionId) {
  return maybeSingle("find donation", supabase.from("donations").select("id").eq("provider_transaction_id", providerTransactionId).limit(1));
}

async function countCertificates(donationId) {
  return exactCount("count certificates", supabase.from("certificates").select("id", { count: "exact", head: true }).eq("donation_id", donationId));
}

async function findCertificate(donationId) {
  return maybeSingle("find certificate", supabase.from("certificates").select("certificate_number").eq("donation_id", donationId).limit(1));
}

async function countTrialCodeRedemptions(trialCodeId, userId) {
  return exactCount(
    "count trial code redemptions",
    supabase.from("trial_code_redemptions").select("id", { count: "exact", head: true }).eq("trial_code_id", trialCodeId).eq("user_id", userId),
  );
}

async function findLicenseEntitlement(userId) {
  return maybeSingle(
    "find license entitlement",
    supabase.from("license_entitlements").select("status").eq("user_id", userId).eq("feature_code", "cloud_sync").limit(1),
  );
}

async function countNotificationReads(notificationId, userId) {
  return exactCount(
    "count notification reads",
    supabase.from("notification_reads").select("notification_id", { count: "exact", head: true }).eq("notification_id", notificationId).eq("user_id", userId),
  );
}

async function main() {
  const ownerPassword = readSecret(ownerPasswordPath);
  const userPassword = readSecret(userPasswordPath);
  const browser = await chromium.launch({ headless: true });
  try {
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
  const userId = await createAuthTestUser(userEmail, userPassword, profileName);

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
  const updatedProfile = await findProfile(userId);
  expect(updatedProfile?.display_name).toBe(profileName);

  await goto(page, "/en/support");
  await fillByLabel(page, "Preferred contact", `${marker}@example.test`);
  await fillByLabel(page, "Subject", supportSubject);
  await fillByLabel(page, "Message", `${marker} support message`);
  await safeClick(page, page.getByRole("button", { name: "Send feedback" }));
  await expect(page).toHaveURL(/feedback=saved/);
  const feedbackId = (await findFeedback(supportSubject, userId))?.id;
  expect(feedbackId).toBeTruthy();

  await safeClick(page, page.getByRole("link", { name: /View thread/ }).first());
  await expect(page.getByRole("heading", { name: supportSubject })).toBeVisible();
  await fillByLabel(page, "Reply", supportUserReply);
  await safeClick(page, page.getByRole("button", { name: "Send reply" }));
  await expect(page.getByText("Reply sent.")).toBeVisible();
  expect(await countSupportMessages(feedbackId, "user", supportUserReply)).toBe(1);

  await context.clearCookies();
  await login(page, ownerEmail, ownerPassword, "/en/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();

  await goto(page, "/en/admin/notifications");
  await fillByLabel(page, "Title", notificationTitle);
  await fillByLabel(page, "Body", `${marker} notification body`);
  await page.getByLabel("Publish").check();
  await safeClick(page, page.getByRole("button", { name: "Create notification" }));
  const notificationId = (await findNotification(notificationTitle))?.id;
  expect(notificationId).toBeTruthy();

  await goto(page, "/en/admin/support-feedback");
  await safeClick(page, page.getByRole("link", { name: /Open thread/ }).first());
  await expect(page.getByRole("heading", { name: supportSubject })).toBeVisible();
  await fillByLabel(page, "Reply to user", supportAdminReply);
  await safeClick(page, page.getByRole("button", { name: "Send reply" }));
  expect(await countSupportMessages(feedbackId, "admin", supportAdminReply)).toBe(1);

  await goto(page, "/en/admin/releases");
  await fillByLabel(page, "Version", releaseVersion);
  await fillByLabel(page, "Release date", "2026-05-06");
  await fillByLabel(page, "Release notes", `${marker} release notes`);
  await page.getByLabel("Use download links").check();
  await fillByLabel(page, "macOS primary URL", "https://example.com/codex-macos.dmg");
  await fillByLabel(page, "Windows primary URL", "https://example.com/codex-windows.exe");
  await page.getByLabel("Published").check();
  await safeClick(page, page.getByRole("button", { name: "Create release" }));
  expect((await findRelease(releaseVersion))?.is_published).toBe(true);

  await goto(page, "/en/admin/licenses");
  await fillByLabel(page, "Batch name", licenseBatchLabel);
  await page.locator('select[name="duration_kind"]').selectOption("month_1");
  await fillByLabel(page, "Quantity", "1");
  await page.locator('form:has(input[name="label"]) select[name="channel_type"]').selectOption("partner");
  await safeClick(page, page.getByRole("button", { name: "Generate codes" }));
  const licenseBatchId = (await findLicenseBatch(licenseBatchLabel))?.id;
  expect(licenseBatchId).toBeTruthy();
  const licenseId = (await findTrialCode(licenseBatchId))?.id;
  expect(licenseId).toBeTruthy();
  const licenseRow = page.getByRole("row").filter({ hasText: licenseBatchLabel }).last();
  await safeClick(page, licenseRow.getByRole("button", { name: "Reveal" }));
  const revealedLicenseCode = licenseRow.locator("code").filter({ hasText: /^[A-Z0-9]{2,4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/ }).last();
  await expect(revealedLicenseCode).toBeVisible({ timeout: 10000 });
  const licenseCode = (await revealedLicenseCode.innerText()).trim();
  expect(licenseCode).toMatch(/^1M/);

  await goto(page, "/en/admin/donations");
  const manualDonationForm = page.locator('form:has(input[name="user_identifier"])').first();
  await expect(manualDonationForm).toBeVisible({ timeout: 10000 });
  await manualDonationForm.locator('input[name="user_identifier"]').fill(userEmail);
  await manualDonationForm.locator('input[name="amount"]').fill("1234");
  await manualDonationForm.locator('input[name="reference"]').fill(donationReference);
  await manualDonationForm.locator('input[name="reason"]').fill(`${marker} verified manual contribution`);
  await submitConfirm(page, manualDonationForm.getByRole("button", { name: "Add manual contribution" }));
  const manualTransactionId = `manual_${donationReference}`;
  const donationId = (await waitForValue("manual donation", async () => findDonation(manualTransactionId)))?.id;
  expect(donationId).toBeTruthy();
  expect(await countCertificates(donationId)).toBeGreaterThan(0);
  const certificateNumber = (await findCertificate(donationId))?.certificate_number;
  expect(certificateNumber).toBeTruthy();

  await goto(page, `/en/admin/users?query=${encodeURIComponent(userEmail)}`);
  const userCheckbox = page.getByLabel(`Select ${userEmail}`);
  await expect(userCheckbox).toBeVisible();
  await userCheckbox.check();
  await expect(page.getByText("1 selected")).toBeVisible();
  await safeClick(page, page.getByRole("button", { name: "Bulk disable" }));
  await expect(page).toHaveURL(/notice=bulk-user-status-updated/);
  expect((await findProfile(userId))?.account_status).toBe("disabled");
  await userCheckbox.check();
  await safeClick(page, page.getByRole("button", { name: "Bulk enable" }));
  await expect(page).toHaveURL(/notice=bulk-user-status-updated/);
  expect((await findProfile(userId))?.account_status).toBe("active");
  await userCheckbox.check();
  await page.locator("#bulk-users-bulk-action-form-admin-role").selectOption("operator");
  await safeClick(page, page.getByRole("button", { name: "Bulk change role" }));
  await expect(page).toHaveURL(/notice=bulk-user-role-updated/);
  expect((await findProfile(userId))?.admin_role).toBe("operator");
  await userCheckbox.check();
  await page.locator("#bulk-users-bulk-action-form-admin-role").selectOption("user");
  await safeClick(page, page.getByRole("button", { name: "Bulk change role" }));
  await expect(page).toHaveURL(/notice=bulk-user-role-updated/);
  expect((await findProfile(userId))?.admin_role).toBe("user");
  await safeClick(page, page.getByRole("link", { name: "Manage user" }).first());
  await expect(page.getByRole("heading", { name: "User operations" })).toBeVisible();

  await context.clearCookies();
  await login(page, userEmail, userPassword);
  await fillByLabel(page, "License code", licenseCode);
  await safeClick(page, page.getByRole("button", { name: "Redeem code" }));
  await expectVisibleOrDump(page, page.getByText("License code redeemed."), "License redemption success message");
  expect(await countTrialCodeRedemptions(licenseId, userId)).toBe(1);
  expect((await findLicenseEntitlement(userId))?.status).toBe("active");
  await expect(page.getByText(certificateNumber).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "View certificate" }).first()).toBeVisible();

  await goto(page, "/en/notifications");
  await expect(page.getByText(notificationTitle).first()).toBeVisible();
  await safeClick(page, page.getByRole("button", { name: "Mark as read" }).first());
  expect(await countNotificationReads(notificationId, userId)).toBe(1);

  await goto(page, `/en/support/feedback/${feedbackId}`);
  await expect(page.getByText(supportAdminReply)).toBeVisible();

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
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
