import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("admin layout alignment", () => {
  it("keeps table-style admin form rows top aligned", () => {
    const supportSettings = source("src/components/admin/admin-support-settings-forms.tsx");
    expect(supportSettings).toContain("xl:items-start");
    expect(supportSettings).toContain("items-start md:col-span-2 xl:col-span-1 xl:pt-7");
    expect(supportSettings).not.toContain("flex items-end md:col-span-2 xl:col-span-1");

    const contributionPricing = source("src/app/[locale]/admin/contribution-pricing/page.tsx");
    expect(contributionPricing).toContain("xl:grid-cols-12 xl:items-start");
    expect(contributionPricing).toContain("items-start sm:col-span-1 xl:col-span-9 xl:justify-end xl:pt-7");
    expect(contributionPricing).not.toContain("items-end sm:col-span-1 xl:col-span-9");
  });

  it("keeps compact admin creation controls aligned to their input tops", () => {
    const donations = source("src/app/[locale]/admin/donations/page.tsx");
    expect(donations).toContain("md:grid-cols-[1fr_11rem_1fr_1fr_auto] md:items-start");
    expect(donations).toContain("md:mt-6");
    expect(donations).not.toContain("self-end rounded-md");

    const notifications = source("src/app/[locale]/admin/notifications/page.tsx");
    expect(notifications).toContain("md:grid-cols-4 md:items-start");
    expect(notifications).toContain("flex min-h-11 items-center");
    expect(notifications).not.toContain("flex min-h-11 items-end");

    const licenses = source("src/app/[locale]/admin/licenses/page.tsx");
    expect(licenses).toContain("lg:grid-cols-[minmax(12rem,16rem)_minmax(18rem,1fr)_auto] lg:items-start");
    expect(licenses).toContain("lg:mt-6");
    expect(licenses).not.toContain("lg:items-end");
  });

  it("uses the wide data workbench and tablet-card table mode on dense admin pages", () => {
    const users = source("src/app/[locale]/admin/users/page.tsx");
    expect(users).toContain("<AdminDataWorkbench>");
    expect(users).toContain('cardsUntil="lg"');
    expect(users).not.toContain('<section className="mx-auto max-w-7xl">');

    const supportFeedback = source("src/app/[locale]/admin/support-feedback/page.tsx");
    expect(supportFeedback).toContain("<AdminDataWorkbench>");
    expect(supportFeedback).toContain('cardsUntil="lg"');
    expect(supportFeedback).not.toContain('<section className="mx-auto max-w-7xl">');

    const licenses = source("src/app/[locale]/admin/licenses/page.tsx");
    expect(licenses).toContain("<AdminDataWorkbench>");
    expect(licenses).toContain('cardsUntil="lg"');
    expect(licenses).not.toContain('<section className="mx-auto max-w-7xl">');
  });

  it("uses the shared workbench header on the users page", () => {
    const users = source("src/app/[locale]/admin/users/page.tsx");
    expect(users).toContain("AdminWorkbenchHeader");
    expect(users).toContain("selectionToolbar=");
    expect(users).toContain("filters=");
    expect(users).toContain("resultSummary=");
  });

  it("uses the shared workbench header on the support feedback page", () => {
    const supportFeedback = source("src/app/[locale]/admin/support-feedback/page.tsx");
    expect(supportFeedback).toContain("AdminWorkbenchHeader");
    expect(supportFeedback).toContain("filters=");
    expect(supportFeedback).toContain("resultSummary=");
  });

  it("keeps license management in wide workbench mode without forcing a full header migration yet", () => {
    const licenses = source("src/app/[locale]/admin/licenses/page.tsx");
    expect(licenses).toContain("<AdminDataWorkbench>");
    expect(licenses).toContain('<AdminTableShell cardsUntil="lg"');
    expect(licenses).toContain("AdminLicenseBulkToolbar");
    expect(licenses).toContain("Keep license management migration incremental");
  });
});
