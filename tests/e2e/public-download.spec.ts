import { expect, test } from "@playwright/test";

test("anonymous visitor can see public download buttons", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
  await expect(page.getByText("Knowledge engine", { exact: true })).toBeVisible();
  const windowsDownload = page.getByRole("link", { name: /Download for Windows/ });
  const macArmDownload = page.getByRole("link", { name: "Download for macOS M chip" });
  const macIntelDownload = page.getByRole("link", { name: "Download for macOS Intel" });
  await expect(windowsDownload).toBeVisible();
  await expect(macArmDownload).toBeVisible();
  await expect(macIntelDownload).toBeVisible();
  await expect(windowsDownload).toHaveText(/Most downloaded/);
  expect(
    await page.locator("a").evaluateAll((links) => {
      const labels = links.map((link) => link.textContent ?? "");
      return labels.findIndex((label) => label.includes("Download for Windows")) < labels.findIndex((label) => label.includes("Download for macOS M chip"));
    }),
  ).toBe(true);
  await expect(page.getByRole("link", { name: /Linux/i })).toHaveCount(0);
  await expect(page.getByText("Downloads stay free. Voluntary support keeps the AI knowledge engine improving.")).toBeVisible();
});
