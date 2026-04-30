import { expect, test } from "@playwright/test";

test("public versions page is available", async ({ page }) => {
  await page.goto("/en/versions");

  await expect(page.getByRole("heading", { name: "Older versions" })).toBeVisible();
  await expect(page.getByText("No public releases have been published yet.")).toBeVisible();
});

test("language switcher preserves the current route semantics", async ({ page }) => {
  await page.goto("/en");

  await page.getByLabel("Language").selectOption("ja");

  await expect(page).toHaveURL(/\/ja\/?$/);
  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
});
