import { describe, expect, it, vi, beforeEach } from "vitest";
import { redeemDashboardTrialCode, updateAccountProfile, updateDashboardPassword } from "@/app/[locale]/dashboard/actions";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const redeemTrialCodeMock = vi.hoisted(() => vi.fn());
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
  redeemTrialCode: redeemTrialCodeMock,
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
    redeemTrialCodeMock.mockReset().mockResolvedValue({ ok: true, validUntil: "2026-05-04T00:00:00.000Z" });
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it("updates the signed-in user's display names", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const formData = new FormData();
    formData.set("display_name", "Ada");
    formData.set("public_display_name", "Ada Supporter");

    await expect(updateAccountProfile("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?profile=saved");

    expect(update).toHaveBeenCalledWith({ display_name: "Ada", public_display_name: "Ada Supporter" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
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

  it("redeems trials only against an active owned desktop session", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: "session-1", machine_code_hash: "machine-hash" },
      error: null,
    }));
    const gt = vi.fn(() => ({ maybeSingle }));
    const is = vi.fn(() => ({ gt }));
    const eqUser = vi.fn(() => ({ is }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const select = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ select }));
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const formData = new FormData();
    formData.set("trial_code", "SPRING-2026");
    formData.set("desktop_session_id", "session-1");

    await expect(redeemDashboardTrialCode("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?trial=saved");

    expect(from).toHaveBeenCalledWith("desktop_sessions");
    expect(select).toHaveBeenCalledWith("id,machine_code_hash");
    expect(eqId).toHaveBeenCalledWith("id", "session-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(is).toHaveBeenCalledWith("revoked_at", null);
    expect(gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(redeemTrialCodeMock).toHaveBeenCalledWith(
      { admin: true },
      {
        userId: "user-1",
        code: "SPRING-2026",
        machineCodeHash: "machine-hash",
      },
    );
  });
});
