import { expect, test } from "@playwright/test";

test("cloud sync license status requires a desktop bearer token", async ({ request }) => {
  const response = await request.get("/api/license/status?feature=cloud_sync");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    authenticated: false,
    allowed: false,
    reason: "not_authenticated",
  });
});

test("unsupported license features are denied", async ({ request }) => {
  const response = await request.get("/api/license/status?feature=unsupported_feature");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({
    authenticated: false,
    allowed: false,
    feature: "unsupported_feature",
    reason: "unsupported_feature",
  });
});

test("public download page still loads after license integration", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for macOS" })).toBeVisible();
});
