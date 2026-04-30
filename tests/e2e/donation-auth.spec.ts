import { expect, test } from "@playwright/test";

test("anonymous donation page redirects to login", async ({ page }) => {
  await page.goto("/en/donate");
  await expect(page).toHaveURL(/\/en\/login/);
  await expect(page.getByRole("heading", { name: "Sign in or create your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
});
