import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("auth-sensitive public pages", () => {
  it("forces dynamic rendering for pages that branch on auth cookies", () => {
    expect(readSource("src/app/[locale]/support/page.tsx")).toContain('export const dynamic = "force-dynamic"');
    expect(readSource("src/app/[locale]/notifications/page.tsx")).toContain('export const dynamic = "force-dynamic"');
  });
});
