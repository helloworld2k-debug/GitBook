import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const locales = ["en", "zh-Hant", "ja", "ko"] as const;

function readMessages(locale: (typeof locales)[number]) {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8")) as {
    admin?: {
      overview: {
        description: string;
        licensesTitle: string;
      };
      shell: {
        licenses: string;
      };
      licenses: {
        title: string;
        batchGenerateTitle: string;
        batchGenerateDescription: string;
        generateBatch: string;
        bulkActionsTitle: string;
        bulkActionsDescription: string;
        selectedIds: string;
        activationStartsOnRedeem: string;
        entitlementsTitle: string;
        emptyEntitlements: string;
        description: string;
        batchesTitle: string;
        licenseCodesTitle: string;
        emptyBatches: string;
        emptyLicenseCodes: string;
        selectAll: string;
        securitySignalsDescription: string;
        fixedPaidDurationsHelp: string;
      };
    };
    dashboard: {
      subtitle: string;
      trial: {
        title: string;
        description: string;
        code: string;
        submit: string;
        saved: string;
        error: string;
      };
      trialRedeemedAt: string;
    };
  };
}

describe("license code copy and page structure", () => {
  it.each(locales)("uses general license-code redemption copy in the %s dashboard", (locale) => {
    const dashboard = readMessages(locale).dashboard;
    const combinedCopy = [
      dashboard.subtitle,
      dashboard.trial.title,
      dashboard.trial.description,
      dashboard.trial.code,
      dashboard.trial.submit,
      dashboard.trial.saved,
      dashboard.trial.error,
      dashboard.trialRedeemedAt,
    ].join("\n");

    expect(combinedCopy).toMatch(/license code|兌換碼|ライセンスコード|라이선스 코드/i);
    expect(combinedCopy).not.toMatch(/trial code|試用碼|試用コード|체험 코드/i);
  });

  it("keeps the admin license codes table markup singular", () => {
    const source = readFileSync(join(process.cwd(), "src/app/[locale]/admin/licenses/page.tsx"), "utf8");
    const licenseCodesTableStart = '<table aria-label={t("licenses.licenseCodesTitle")} className="min-w-[1560px] table-fixed text-left text-sm">';

    expect(source.split(licenseCodesTableStart)).toHaveLength(2);
  });

  it("uses redemption copy for the Traditional Chinese admin license area", () => {
    const admin = readMessages("zh-Hant").admin;

    expect(admin?.overview.description).toContain("兌換");
    expect(admin?.overview.licensesTitle).toBe("兌換");
    expect(admin?.shell.licenses).toBe("兌換");
    expect(admin?.licenses.title).toBe("兌換管理");

    const combinedAdminLicenseCopy = [
      admin?.licenses.batchGenerateTitle,
      admin?.licenses.batchGenerateDescription,
      admin?.licenses.generateBatch,
      admin?.licenses.bulkActionsTitle,
      admin?.licenses.bulkActionsDescription,
      admin?.licenses.selectedIds,
      admin?.licenses.activationStartsOnRedeem,
      admin?.licenses.entitlementsTitle,
      admin?.licenses.emptyEntitlements,
      admin?.licenses.description,
      admin?.licenses.batchesTitle,
      admin?.licenses.licenseCodesTitle,
      admin?.licenses.emptyBatches,
      admin?.licenses.emptyLicenseCodes,
      admin?.licenses.selectAll,
      admin?.licenses.securitySignalsDescription,
      admin?.licenses.fixedPaidDurationsHelp,
    ].join("\n");

    expect(combinedAdminLicenseCopy).toContain("兌換碼");
    expect(combinedAdminLicenseCopy).not.toContain("授權");
  });
});
