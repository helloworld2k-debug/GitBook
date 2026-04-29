import { expect, test } from "@playwright/test";

const locales = ["en", "zh-Hant", "ja", "ko"];

test("root redirects to the English public download page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.getByRole("heading", { name: "Three Friends" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for macOS" })).toBeVisible();
});

test("localized public download pages load directly", async ({ page }) => {
  for (const locale of locales) {
    await page.goto(`/${locale}`);

    await expect(page.getByRole("heading", { name: "Three Friends" })).toBeVisible();
  }
});
