import { describe, expect, it } from "vitest";

import {
  classifyExternalUrl,
  createSummary,
  extractDownloadLinks,
  normalizeCheckHostNodeResult,
  probeDownloadUrl,
} from "../../scripts/china-access-audit.mjs";

describe("China access audit helpers", () => {
  it("classifies domestic access risks in external URLs", () => {
    expect(classifyExternalUrl("https://github.com/helloworld2k-debug/GitBook/releases/latest")).toMatchObject({
      level: "high",
      reason: "GitHub is not a reliable download path for mainland China users.",
    });
    expect(classifyExternalUrl("https://accounts.google.com/o/oauth2/v2/auth")).toMatchObject({
      level: "high",
      reason: "Google services are not a reliable login path for mainland China users.",
    });
    expect(classifyExternalUrl("https://discord.gg/example")).toMatchObject({
      level: "high",
      reason: "Discord is not a reliable support channel for mainland China users.",
    });
    expect(classifyExternalUrl("https://dzsnhbszojdaghvolcnq.supabase.co/storage/v1/object/public/file.zip")).toMatchObject({
      level: "medium",
      reason: "Supabase Storage should be verified from mainland China nodes.",
    });
  });

  it("extracts download links from rendered anchor markup", () => {
    const html = `
      <a href="https://example.com/mac.dmg">Download for macOS</a>
      <a href="https://example.com/win.exe"><span>Download for Windows</span></a>
      <a href="/en/contributions">Contribute</a>
    `;

    expect(extractDownloadLinks(html)).toEqual([
      { href: "https://example.com/mac.dmg", label: "Download for macOS" },
      { href: "https://example.com/win.exe", label: "Download for Windows" },
    ]);
  });

  it("normalizes Check-Host HTTP node results", () => {
    expect(normalizeCheckHostNodeResult([[1, 1.074, "OK", "200", "216.198.79.1"]])).toEqual({
      ip: "216.198.79.1",
      ok: true,
      seconds: 1.074,
      statusCode: 200,
      statusText: "OK",
    });
    expect(normalizeCheckHostNodeResult(null)).toEqual({
      ip: null,
      ok: false,
      seconds: null,
      statusCode: null,
      statusText: "pending",
    });
  });

  it("summarizes failed required checks and skipped optional checks separately", () => {
    const summary = createSummary([
      { label: "mainland homepage", required: true, status: "pass" },
      { label: "checkout", required: true, status: "fail" },
      { label: "email login", required: false, status: "skipped" },
    ]);

    expect(summary).toEqual({
      failedRequired: ["checkout"],
      passed: 1,
      risky: 0,
      skippedOptional: ["email login"],
      status: "fail",
      total: 3,
    });
  });

  it("uses a range probe for large download URLs instead of fetching the full body", async () => {
    const calls: Array<{ args: string[]; command: string }> = [];
    const check = await probeDownloadUrl(
      "mainland download Download for Windows",
      "https://dzsnhbszojdaghvolcnq.supabase.co/storage/v1/object/public/software-releases/windows/GitBookAI.zip",
      true,
      async (command, args) => {
        calls.push({ args, command });
        return {
          ok: true,
          stderr: "",
          stdout: "range_status:206 size:1024 type:application/zip time:0.349035",
        };
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("curl");
    expect(calls[0]?.args).toEqual(expect.arrayContaining(["-r", "0-1023"]));
    expect(calls[0]?.args).toContain("-o");
    expect(calls[0]?.args).toContain("/dev/null");
    expect(check).toMatchObject({
      label: "mainland download Download for Windows",
      required: true,
      status: "pass",
    });
    expect(check.details).toMatchObject({
      probe: "range",
      statusCode: 206,
      sizeDownloaded: 1024,
    });
  });
});
