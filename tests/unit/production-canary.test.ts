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
});
