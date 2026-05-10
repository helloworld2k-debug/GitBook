import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const doc = readFileSync(join(process.cwd(), "docs/desktop-cloud-sync-integration.md"), "utf8");

describe("desktop cloud sync integration documentation", () => {
  it("separates account login from cloud sync device ownership", () => {
    expect(doc).toContain("A website account may be signed in on more than one desktop device.");
    expect(doc).toContain("device identity is not used to block account sign-in");
    expect(doc).toContain("only one `machineCode` can own the active cloud sync lease");
  });

  it("defines the three desktop identity values used by vendors", () => {
    expect(doc).toContain("`desktopSessionId` identifies one signed-in desktop session");
    expect(doc).toContain("`deviceId` identifies a desktop app installation");
    expect(doc).toContain("`machineCode` identifies the physical computer");
  });
});
