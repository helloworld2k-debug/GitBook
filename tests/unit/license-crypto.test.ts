import { describe, expect, it } from "vitest";
import {
  CLOUD_SYNC_FEATURE,
  CLOUD_SYNC_LEASE_TTL_SECONDS,
  DESKTOP_AUTH_CODE_TTL_SECONDS,
  DESKTOP_SESSION_TTL_DAYS,
  getEntitlementDaysForTier,
} from "@/lib/license/constants";
import { hashDesktopSecret, normalizeMachineCode } from "@/lib/license/hash";
import { generateDesktopSecret } from "@/lib/license/tokens";

describe("license constants", () => {
  it("maps donation tiers to entitlement days", () => {
    expect(getEntitlementDaysForTier("monthly")).toBe(30);
    expect(getEntitlementDaysForTier("quarterly")).toBe(90);
    expect(getEntitlementDaysForTier("yearly")).toBe(365);
    expect(getEntitlementDaysForTier("unknown")).toBeNull();
    expect(getEntitlementDaysForTier(null)).toBeNull();
    expect(getEntitlementDaysForTier(undefined)).toBeNull();
  });

  it("uses cloud sync as the first feature code", () => {
    expect(CLOUD_SYNC_FEATURE).toBe("cloud_sync");
    expect(DESKTOP_AUTH_CODE_TTL_SECONDS).toBe(300);
    expect(DESKTOP_SESSION_TTL_DAYS).toBe(30);
    expect(CLOUD_SYNC_LEASE_TTL_SECONDS).toBe(120);
  });
});

describe("license hashing", () => {
  it("normalizes machine codes before hashing", async () => {
    expect(normalizeMachineCode("  ABC-def  ")).toBe("abc-def");
  });

  it("hashes secrets deterministically without returning raw values", async () => {
    const hashA = await hashDesktopSecret("ABC-def", "machine");
    const hashB = await hashDesktopSecret("abc-def", "machine");

    expect(hashA).toBe(hashB);
    expect(hashA).not.toContain("ABC");
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes the same value differently for different purposes", async () => {
    const authCodeHash = await hashDesktopSecret("shared-secret", "auth_code");
    const tokenHash = await hashDesktopSecret("shared-secret", "desktop_token");

    expect(authCodeHash).not.toBe(tokenHash);
  });

  it("throws clearly when production hash salt is missing", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalHashSalt = process.env.LICENSE_HASH_SALT;

    process.env.NODE_ENV = "production";
    delete process.env.LICENSE_HASH_SALT;

    try {
      await expect(hashDesktopSecret("shared-secret", "desktop_token")).rejects.toThrow(
        "LICENSE_HASH_SALT must be set in production",
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;

      if (originalHashSalt === undefined) {
        delete process.env.LICENSE_HASH_SALT;
      } else {
        process.env.LICENSE_HASH_SALT = originalHashSalt;
      }
    }
  });
});

describe("desktop token generation", () => {
  it("generates URL-safe secrets", () => {
    const token = generateDesktopSecret();

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
