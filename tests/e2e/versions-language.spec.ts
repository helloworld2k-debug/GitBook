import { expect, test } from "@playwright/test";

test("public versions page is available", async ({ page }) => {
  await page.goto("/en/versions");

  await expect(page.getByRole("heading", { name: "Older versions" })).toBeVisible();
  const releaseLinks = page.getByRole("link", { name: "macOS M chip Primary" });
  const releaseLinkCount = await releaseLinks.count();
  if (releaseLinkCount > 0) {
    expect(releaseLinkCount).toBeGreaterThan(0);
  } else {
    await expect(page.getByText("No public releases have been published yet.")).toBeVisible();
  }
});

test("language switcher preserves the current route semantics", async ({ page }) => {
  await page.goto("/en");

  await page.getByLabel("Language").click();
  await page.getByRole("menuitem", { name: "ZH 中文" }).click();

  await expect(page).toHaveURL(/\/zh\/?$/);
  await expect(page.getByRole("heading", { name: "GitBook AI" })).toBeVisible();
});
