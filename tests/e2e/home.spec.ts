import { expect, test } from "@playwright/test";

const locales = ["en", "zh-Hant", "ja", "ko"];

test("root redirects to the English localized scaffold page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /to get started, edit the page\.tsx file/i,
    }),
  ).toBeVisible();
  await expect(page.getByAltText("Next.js logo")).toBeVisible();
});

test("localized scaffold pages load directly", async ({ page }) => {
  for (const locale of locales) {
    await page.goto(`/${locale}`);

    await expect(
      page.getByRole("heading", {
        name: /to get started, edit the page\.tsx file/i,
      }),
    ).toBeVisible();
    await expect(page.getByAltText("Next.js logo")).toBeVisible();
  }
});
