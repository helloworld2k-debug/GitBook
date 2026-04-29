import { expect, test } from "@playwright/test";

test("anonymous visitor can see public download buttons", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Three Friends" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for macOS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for Windows" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for Linux" })).toBeVisible();
  await expect(page.getByText("Downloads are free. Donations support ongoing development.")).toBeVisible();
});
