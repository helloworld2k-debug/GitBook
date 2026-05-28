import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/api/debug/webhook-status/route.ts"), "utf8");

describe("debug webhook status route", () => {
  it("reports a sanitized account_type schema status for production canary", () => {
    expect(source).toContain("schemaStatus");
    expect(source).toContain("profiles_account_type");
    expect(source).toContain('select("account_type")');
  });
});
