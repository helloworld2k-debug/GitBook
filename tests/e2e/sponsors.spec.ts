import { expect, test } from "@playwright/test";

test("public sponsors page loads", async ({ page }) => {
  await page.goto("/en/sponsors");

  await expect(page.getByRole("heading", { level: 1, name: "Supporters" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Public supporters" })).toBeVisible();
});
