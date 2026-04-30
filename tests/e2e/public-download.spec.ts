import { expect, test } from "@playwright/test";

test("anonymous visitor can see public download buttons", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
  await expect(page.getByLabel("Animated code intelligence background")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for macOS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download for Windows" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Linux/i })).toHaveCount(0);
  await expect(page.getByText("Downloads stay free. Donations keep the AI knowledge engine improving.")).toBeVisible();
});
