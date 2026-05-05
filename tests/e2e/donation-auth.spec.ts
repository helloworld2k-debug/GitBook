import { expect, test } from "@playwright/test";

test("anonymous visitors can review contribution tiers without being redirected to login", async ({ page }) => {
  await page.goto("/en/contributions");
  await expect(page).toHaveURL(/\/en\/contributions/);
  await expect(page.getByRole("heading", { name: "Contribute to GitBook AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Contribute now" }).first()).toBeVisible();
});

test("contributions page explains cancelled checkout state", async ({ page }) => {
  await page.goto("/en/contributions?payment=cancelled");

  await expect(page.getByRole("heading", { name: "Contribute to GitBook AI" })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Checkout was cancelled. You can review the support tiers and try again when ready." }),
  ).toBeVisible();
});
