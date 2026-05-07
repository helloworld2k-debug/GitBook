import { describe, expect, it, vi, beforeEach } from "vitest";
import { redeemDashboardLicenseCode, signOutAction, updateAccountProfile, updateDashboardPassword } from "@/app/[locale]/dashboard/actions";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const redeemLicenseCodeMock = vi.hoisted(() => vi.fn());
const checkLicenseRedeemRiskMock = vi.hoisted(() => vi.fn());
const recordLicenseRedeemAttemptMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/license/trial-codes", () => ({
  redeemLicenseCode: redeemLicenseCodeMock,
}));

vi.mock("@/lib/license/redeem-security", () => ({
  checkLicenseRedeemRisk: checkLicenseRedeemRiskMock,
  recordLicenseRedeemAttempt: recordLicenseRedeemAttemptMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({
    "user-agent": "Vitest",
    "x-forwarded-for": "203.0.113.10",
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("dashboard account actions", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    createSupabaseAdminClientMock.mockReset().mockReturnValue({ admin: true });
    requireUserMock.mockReset().mockResolvedValue({ id: "user-1", email: "user@example.com" });
    checkLicenseRedeemRiskMock.mockReset().mockResolvedValue({ ok: true });
    recordLicenseRedeemAttemptMock.mockReset().mockResolvedValue(undefined);
    redeemLicenseCodeMock.mockReset().mockResolvedValue({ ok: true, validUntil: "2026-05-04T00:00:00.000Z" });
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it("updates the signed-in user's display names", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("display_name", "Ada");

    await expect(updateAccountProfile("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?profile=saved");

    expect(update).toHaveBeenCalledWith({ display_name: "Ada" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched password confirmation before calling Supabase", async () => {
    const updateUser = vi.fn();
    createSupabaseServerClientMock.mockResolvedValue({ auth: { updateUser } });

    const formData = new FormData();
    formData.set("password", "new-password-1");
    formData.set("confirm_password", "different-password");

    await expect(updateDashboardPassword("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?password=mismatch");

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the current user's password when confirmation matches", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    createSupabaseServerClientMock.mockResolvedValue({ auth: { updateUser } });

    const formData = new FormData();
    formData.set("password", "new-password-1");
    formData.set("confirm_password", "new-password-1");

    await expect(updateDashboardPassword("ko", formData)).rejects.toThrow("NEXT_REDIRECT:/ko/dashboard?password=saved");

    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
  });

  it("redeems license codes at the account level without requiring a desktop session", async () => {
    const formData = new FormData();
    formData.set("license_code", "1MAB-CDEF-GHJK-LMNP");

    await expect(redeemDashboardLicenseCode("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?trial=saved");

    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(checkLicenseRedeemRiskMock).toHaveBeenCalledWith(
      { admin: true },
      expect.objectContaining({
        ipAddress: "203.0.113.10",
        userId: "user-1",
      }),
    );
    expect(redeemLicenseCodeMock).toHaveBeenCalledWith(
      { admin: true },
      {
        userId: "user-1",
        code: "1MAB-CDEF-GHJK-LMNP",
      },
    );
    expect(recordLicenseRedeemAttemptMock).toHaveBeenCalledWith(
      { admin: true },
      expect.objectContaining({
        reason: "redeemed",
        result: "success",
      }),
    );
  });

  it("records blocked license redemption attempts and returns a generic error", async () => {
    checkLicenseRedeemRiskMock.mockResolvedValueOnce({
      ok: false,
      reason: "user_rate_limited",
      retryAfterSeconds: 1800,
    });
    const formData = new FormData();
    formData.set("license_code", "1MAB-CDEF-GHJK-LMNP");

    await expect(redeemDashboardLicenseCode("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?trial=error");

    expect(redeemLicenseCodeMock).not.toHaveBeenCalled();
    expect(recordLicenseRedeemAttemptMock).toHaveBeenCalledWith(
      { admin: true },
      expect.objectContaining({
        reason: "user_rate_limited",
        result: "blocked",
      }),
    );
  });

  it("records detailed license redemption failures while returning a generic user error", async () => {
    redeemLicenseCodeMock.mockResolvedValueOnce({ ok: false, reason: "trial_code_invalid" });
    const formData = new FormData();
    formData.set("license_code", "BAD-CODE");

    await expect(redeemDashboardLicenseCode("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?trial=error");

    expect(recordLicenseRedeemAttemptMock).toHaveBeenCalledWith(
      { admin: true },
      expect.objectContaining({
        reason: "trial_code_invalid",
        result: "failure",
      }),
    );
  });

  it("signs out and returns to the localized home page", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    createSupabaseServerClientMock.mockResolvedValue({ auth: { signOut } });

    await expect(signOutAction("ja")).rejects.toThrow("NEXT_REDIRECT:/ja");

    expect(signOut).toHaveBeenCalled();
  });
});
