import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "scripts/production-canary.mjs"), "utf8");

describe("production canary script", () => {
  it("does not require the intentionally hidden release archive page", () => {
    const requiredPathsBlock = source.match(/const requiredPaths = \[(?<body>[\s\S]*?)\];/)?.groups?.body ?? "";

    expect(requiredPathsBlock).not.toContain('"/en/versions"');
  });

  it("rejects streamed not-found pages even when the HTTP status and title look healthy", () => {
    expect(source).toContain("isUnexpectedPageBody");
    expect(source).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(source).toContain("This page you're looking for doesn't exist");
  });

  it("includes production schema and admin entry checks", () => {
    expect(source).toContain("checkProductionSchema");
    expect(source).toContain("schema profiles.account_type");
    expect(source).toContain("checkAdminEntry");
    expect(source).toContain("/en/admin/users");
  });

  it("keeps reporting JSON when an individual page fetch fails", () => {
    const checkPageSource = source.match(/async function checkPage[\s\S]*?\n}\n/)?.[0] ?? "";

    expect(checkPageSource).toContain("catch (error)");
    expect(checkPageSource).toContain("ok: false");
  });
});
