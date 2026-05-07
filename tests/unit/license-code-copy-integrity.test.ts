import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const locales = ["en", "zh-Hant", "ja", "ko"] as const;

function readMessages(locale: (typeof locales)[number]) {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8")) as {
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

    expect(combinedCopy).toMatch(/license code|授權碼|ライセンスコード|라이선스 코드/i);
    expect(combinedCopy).not.toMatch(/trial code|試用碼|試用コード|체험 코드/i);
  });

  it("keeps the admin license codes table markup singular", () => {
    const source = readFileSync(join(process.cwd(), "src/app/[locale]/admin/licenses/page.tsx"), "utf8");
    const licenseCodesTableStart = '<table aria-label={t("licenses.licenseCodesTitle")} className="min-w-[1560px] table-fixed text-left text-sm">';

    expect(source.split(licenseCodesTableStart)).toHaveLength(2);
  });
});
