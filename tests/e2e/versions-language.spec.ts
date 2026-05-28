import { expect, test } from "@playwright/test";

test("public versions page is hidden", async ({ page }) => {
  await page.goto("/en/versions");

  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("The page you're looking for doesn't exist.")).toBeVisible();
});

test("language switcher preserves the current route semantics", async ({ page }) => {
  await page.goto("/en");

  await page.getByLabel("Language").click();
  await page.getByRole("menuitem", { name: "JP 日本語" }).click();

  await expect(page).toHaveURL(/\/ja\/?$/);
  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
});
