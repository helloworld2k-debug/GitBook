import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrialCode,
  revokeCloudSyncLease,
  revokeDesktopSession,
  setTrialCodeActive,
  unbindTrialMachine,
  updateTrialCode,
  updateUserAccountStatus,
  updateUserAdminRole,
} from "@/app/[locale]/admin/actions";
import { CLOUD_SYNC_FEATURE } from "@/lib/license/constants";
import { hashDesktopSecret } from "@/lib/license/hash";

type MutationResult = Promise<{ error: null }>;

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
  requireOwner: mocks.requireOwner,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin license actions", () => {
  beforeEach(() => {
    process.env.LICENSE_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.requireOwner.mockReset().mockResolvedValue({ id: "owner-1" });
    mocks.createSupabaseAdminClient.mockReset();
    mocks.revalidatePath.mockClear();
  });

  it("creates trial codes with a hashed code and never persists the raw code", async () => {
    const insert = vi.fn<(payload: unknown) => MutationResult>(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("code", "ABCD-EFGH-IJKL-MNOP");
    formData.set("label", "Spring 2026 launch trial");
    formData.set("trial_days", "3");
    formData.set("max_redemptions", "100");
    formData.set("starts_at", "2026-05-01T00:00:00.000Z");
    formData.set("ends_at", "2026-06-01T00:00:00.000Z");

    await createTrialCode(formData);

    const inserted = insert.mock.calls[0]?.[0];
    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(inserted).toEqual({
      code_hash: await hashDesktopSecret("ABCD-EFGH-IJKL-MNOP", "trial_code"),
      code_mask: "ABCD-****-****-MNOP",
      created_by: "admin-1",
      duration_kind: "trial_3_day",
      ends_at: "2026-06-01T00:00:00.000Z",
      encrypted_code_algorithm: "aes-256-gcm",
      encrypted_code_ciphertext: expect.any(String),
      encrypted_code_iv: expect.any(String),
      encrypted_code_tag: expect.any(String),
      feature_code: CLOUD_SYNC_FEATURE,
      is_active: true,
      label: "Spring 2026 launch trial",
      max_redemptions: 100,
      starts_at: "2026-05-01T00:00:00.000Z",
      trial_days: 3,
    });
    expect(JSON.stringify(inserted)).not.toContain("ABCD-EFGH-IJKL-MNOP");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/licenses");
  });

  it("rejects invalid trial code windows before writing", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("code", "ABCD-EFGH-IJKL-MNOP");
    formData.set("label", "Spring 2026 launch trial");
    formData.set("trial_days", "3");
    formData.set("starts_at", "2026-06-01T00:00:00.000Z");
    formData.set("ends_at", "2026-05-01T00:00:00.000Z");

    await expect(createTrialCode(formData)).rejects.toThrow("End date must be after start date");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects trial code durations over 365 days before writing", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("code", "ABCD-EFGH-IJKL-MNOP");
    formData.set("label", "Spring 2026 launch trial");
    formData.set("trial_days", "366");
    formData.set("starts_at", "2026-05-01T00:00:00.000Z");
    formData.set("ends_at", "2026-06-01T00:00:00.000Z");

    await expect(createTrialCode(formData)).rejects.toThrow("Trial days must be between 1 and 365");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("toggles trial code active state", async () => {
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ja");
    formData.set("trial_code_id", "trial-1");
    formData.set("is_active", "false");

    await setTrialCodeActive(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("ja");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, updated_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", "trial-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/admin/licenses");
  });

  it("updates trial code labels, limits, and active periods", async () => {
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("trial_code_id", "trial-1");
    formData.set("label", "Spring maintenance trial");
    formData.set("trial_days", "3");
    formData.set("max_redemptions", "");
    formData.set("starts_at", "2026-05-01T00:00:00.000Z");
    formData.set("ends_at", "2026-07-01T00:00:00.000Z");

    await updateTrialCode(formData);

    expect(update).toHaveBeenCalledWith({
      ends_at: "2026-07-01T00:00:00.000Z",
      label: "Spring maintenance trial",
      max_redemptions: null,
      starts_at: "2026-05-01T00:00:00.000Z",
      trial_days: 3,
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "trial-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/licenses");
  });

  it("revokes desktop sessions", async () => {
    const rpc = vi.fn<(functionName: string, args: unknown) => MutationResult>(async () => ({ error: null }));
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("desktop_session_id", "session-1");

    await revokeDesktopSession(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("ko");
    expect(rpc).toHaveBeenCalledWith("revoke_desktop_session_with_leases", {
      input_desktop_session_id: "session-1",
      input_now: expect.any(String),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ko/admin/licenses");
  });

  it("revokes cloud sync leases and updates the timestamp", async () => {
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_leases") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "zh-Hant");
    formData.set("cloud_sync_lease_id", "lease-1");

    await revokeCloudSyncLease(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("zh-Hant");
    expect(update).toHaveBeenCalledWith({
      revoked_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "lease-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/zh-Hant/admin/licenses");
  });

  it("lets operators update user account status without reading passwords", async () => {
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_id", "user-1");
    formData.set("account_status", "disabled");

    await updateUserAccountStatus(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ account_status: "disabled", updated_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users");
  });

  it("requires an owner before changing admin roles", async () => {
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ja");
    formData.set("user_id", "user-1");
    formData.set("admin_role", "operator");

    await updateUserAdminRole(formData);

    expect(mocks.requireOwner).toHaveBeenCalledWith("ja");
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      admin_role: "operator",
      is_admin: false,
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/admin/users");
  });

  it("unbinds a trial redemption machine claim for admin support", async () => {
    const redemptionSingle = vi.fn(async () => ({
      data: { id: "redemption-1", machine_code_hash: "hash-1" },
      error: null,
    }));
    const redemptionSelectEq = vi.fn(() => ({ single: redemptionSingle }));
    const redemptionSelect = vi.fn(() => ({ eq: redemptionSelectEq }));
    const redemptionUpdateEq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const redemptionUpdate = vi.fn(() => ({ eq: redemptionUpdateEq }));
    const claimFeatureEq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const claimMachineEq = vi.fn(() => ({ eq: claimFeatureEq }));
    const claimDelete = vi.fn(() => ({ eq: claimMachineEq }));
    const from = vi.fn((table: string) => {
      if (table === "trial_code_redemptions") {
        return { select: redemptionSelect, update: redemptionUpdate };
      }

      if (table === "machine_trial_claims") {
        return { delete: claimDelete };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("trial_redemption_id", "redemption-1");

    await unbindTrialMachine(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(redemptionSelect).toHaveBeenCalledWith("id,machine_code_hash");
    expect(redemptionSelectEq).toHaveBeenCalledWith("id", "redemption-1");
    expect(claimMachineEq).toHaveBeenCalledWith("machine_code_hash", "hash-1");
    expect(claimFeatureEq).toHaveBeenCalledWith("feature_code", CLOUD_SYNC_FEATURE);
    expect(redemptionUpdate).toHaveBeenCalledWith({
      bound_at: null,
      desktop_session_id: null,
      device_id: null,
      machine_code_hash: null,
    });
    expect(redemptionUpdateEq).toHaveBeenCalledWith("id", "redemption-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/licenses");
  });
});
