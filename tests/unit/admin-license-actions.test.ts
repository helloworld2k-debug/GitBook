import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrialCode,
  deleteTrialCode,
  grantCloudSyncCooldownOverride,
  revealLicenseCode,
  revokeCloudSyncLease,
  revokeDesktopSession,
  setTrialCodeActive,
  updateCloudSyncCooldownSetting,
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
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
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

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

describe("admin license actions", () => {
  beforeEach(() => {
    process.env.LICENSE_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.requireOwner.mockReset().mockResolvedValue({ id: "owner-1" });
    mocks.createSupabaseAdminClient.mockReset();
    mocks.redirect.mockClear();
    mocks.revalidatePath.mockClear();
  });

  it("creates one auto-generated trial code with a hashed code and never persists the raw code", async () => {
    const single = vi.fn(async () => ({
      data: {
        code_mask: "ABCD-****-****-WXYZ",
        id: "trial-1",
        label: "Spring 2026 launch trial",
        trial_days: 3,
      },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { insert };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("label", "Spring 2026 launch trial");
    formData.set("trial_days", "3");

    await expect(createTrialCode(formData)).rejects.toThrow("redirect:/en/admin/licenses?notice=trial-code-created");

    const inserted = insert.mock.calls[0]?.[0];
    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(inserted).toEqual(expect.objectContaining({
      code_hash: expect.any(String),
      code_mask: expect.stringMatching(/^[A-Z2-9]{4}-\*\*\*\*-\*\*\*\*-[A-Z2-9]{4}$/),
      created_by: "admin-1",
      duration_kind: "trial_3_day",
      encrypted_code_algorithm: "aes-256-gcm",
      encrypted_code_ciphertext: expect.any(String),
      encrypted_code_iv: expect.any(String),
      encrypted_code_tag: expect.any(String),
      feature_code: CLOUD_SYNC_FEATURE,
      is_active: true,
      label: "Spring 2026 launch trial",
      max_redemptions: 1,
      trial_days: 3,
    }));
    expect((inserted as { code_hash: string }).code_hash).not.toBe(await hashDesktopSecret("ABCD-EFGH-IJKL-MNOP", "trial_code"));
    expect(inserted).not.toHaveProperty("starts_at");
    expect(inserted).not.toHaveProperty("ends_at");
    expect(JSON.stringify(inserted)).not.toContain("ABCD-EFGH-IJKL-MNOP");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/licenses");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "create_trial_code" }));
  });

  it("rejects trial code durations over 7 days before writing", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("label", "Spring 2026 launch trial");
    formData.set("trial_days", "8");

    await expect(createTrialCode(formData)).rejects.toThrow("Trial days must be between 1 and 7");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("toggles trial code active state", async () => {
    const single = vi.fn(async () => ({ data: { is_active: true }, error: null }));
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { select, update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ja");
    formData.set("trial_code_id", "trial-1");
    formData.set("is_active", "false");

    await expect(setTrialCodeActive(formData)).rejects.toThrow("redirect:/ja/admin/licenses?notice=trial-code-status-updated");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("ja");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, updated_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("id", "trial-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/admin/licenses");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "set_trial_code_active" }));
  });

  it("updates trial code labels and redemption limits without activation windows", async () => {
    const single = vi.fn(async () => ({ data: { label: "Old", trial_days: 3 }, error: null }));
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { select, update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("trial_code_id", "trial-1");
    formData.set("label", "Spring maintenance trial");
    formData.set("trial_days", "7");

    await expect(updateTrialCode(formData)).rejects.toThrow("redirect:/en/admin/licenses?notice=trial-code-updated");

    expect(update).toHaveBeenCalledWith({
      label: "Spring maintenance trial",
      trial_days: 7,
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "trial-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/licenses");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "update_trial_code" }));
  });

  it("reveals an encrypted trial code for admin delivery and audits the view", async () => {
    const encrypted = {
      encrypted_code_algorithm: "aes-256-gcm",
      encrypted_code_ciphertext: "encrypted-ciphertext",
      encrypted_code_iv: "encrypted-iv",
      encrypted_code_tag: "encrypted-tag",
      id: "trial-1",
    };
    const single = vi.fn(async () => ({ data: encrypted, error: null }));
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") return { select };
      if (table === "admin_audit_logs") return { insert: auditInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });
    const decryptSpy = vi.spyOn(await import("@/lib/license/license-codes"), "decryptLicenseCode").mockReturnValueOnce("ABCD-EFGH-JKLM-NPQR");

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("trial_code_id", "trial-1");

    await expect(revealLicenseCode(formData)).resolves.toEqual({ code: "ABCD-EFGH-JKLM-NPQR" });

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(select).toHaveBeenCalledWith("id,encrypted_code_algorithm,encrypted_code_ciphertext,encrypted_code_iv,encrypted_code_tag");
    expect(eq).toHaveBeenCalledWith("id", "trial-1");
    expect(decryptSpy).toHaveBeenCalled();
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "reveal_license_code",
      admin_user_id: "admin-1",
      target_id: "trial-1",
      target_type: "trial_code",
    }));
    decryptSpy.mockRestore();
  });

  it("soft deletes trial codes and records who deleted them", async () => {
    const single = vi.fn(async () => ({
      data: {
        code_mask: "ABCD-****-****-WXYZ",
        is_active: true,
        label: "Launch trial",
        trial_days: 3,
      },
      error: null,
    }));
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") return { select, update };
      if (table === "admin_audit_logs") return { insert: auditInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "zh-Hant");
    formData.set("trial_code_id", "trial-1");

    await expect(deleteTrialCode(formData)).rejects.toThrow("redirect:/zh-Hant/admin/licenses?notice=trial-code-deleted");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("zh-Hant");
    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      is_active: false,
      updated_at: expect.any(String),
      updated_by: "admin-1",
    });
    expect(eq).toHaveBeenCalledWith("id", "trial-1");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "delete_trial_code",
      admin_user_id: "admin-1",
      before: expect.objectContaining({ code_mask: "ABCD-****-****-WXYZ" }),
      target_id: "trial-1",
      target_type: "trial_code",
    }));
  });

  it("revokes desktop sessions", async () => {
    const rpc = vi.fn<(functionName: string, args: unknown) => MutationResult>(async () => ({ error: null }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "admin_audit_logs") return { insert: auditInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from, rpc });

    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("desktop_session_id", "session-1");

    await expect(revokeDesktopSession(formData)).rejects.toThrow("redirect:/ko/admin/licenses?notice=desktop-session-revoked");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("ko");
    expect(rpc).toHaveBeenCalledWith("revoke_desktop_session_with_leases", {
      input_desktop_session_id: "session-1",
      input_now: expect.any(String),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ko/admin/licenses");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "revoke_desktop_session" }));
  });

  it("revokes cloud sync leases and updates the timestamp", async () => {
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_leases") {
        return { update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "zh-Hant");
    formData.set("cloud_sync_lease_id", "lease-1");

    await expect(revokeCloudSyncLease(formData)).rejects.toThrow("redirect:/zh-Hant/admin/licenses?notice=cloud-sync-lease-revoked");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("zh-Hant");
    expect(update).toHaveBeenCalledWith({
      revoked_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "lease-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/zh-Hant/admin/licenses");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "revoke_cloud_sync_lease" }));
  });

  it("updates the global cloud sync cooldown setting with audit logging", async () => {
    const single = vi.fn(async () => ({
      data: { key: "cloud_sync_device_switch_cooldown_minutes", value: "180" },
      error: null,
    }));
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const upsert = vi.fn(async () => ({ error: null }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_settings") return { select, upsert };
      if (table === "admin_audit_logs") return { insert: auditInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("cooldown_minutes", "240");
    formData.set("reason", "Operational support window");

    await expect(updateCloudSyncCooldownSetting(formData)).rejects.toThrow("redirect:/en/admin/licenses?notice=cloud-sync-cooldown-updated");

    expect(upsert).toHaveBeenCalledWith({
      key: "cloud_sync_device_switch_cooldown_minutes",
      updated_at: expect.any(String),
      updated_by: "admin-1",
      value: "240",
    });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_cloud_sync_cooldown_setting",
      after: { value: "240" },
      before: { key: "cloud_sync_device_switch_cooldown_minutes", value: "180" },
      reason: "Operational support window",
      target_id: "cloud_sync_device_switch_cooldown_minutes",
      target_type: "cloud_sync_setting",
    }));
  });

  it("grants a user cooldown override with an expiry and audit logging", async () => {
    const single = vi.fn(async () => ({
        data: { id: "override-1", expires_at: "2026-12-01T06:00:00.000Z", user_id: "user-1" },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_cooldown_overrides") return { insert };
      if (table === "admin_audit_logs") return { insert: auditInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_id", "user-1");
    formData.set("expires_at", "2026-12-01T06:00:00.000Z");
    formData.set("reason", "Support-approved emergency device switch");

    await expect(grantCloudSyncCooldownOverride(formData)).rejects.toThrow("redirect:/en/admin/users/user-1?notice=cloud-sync-override-granted");

    expect(insert).toHaveBeenCalledWith({
      created_by: "admin-1",
      expires_at: "2026-12-01T06:00:00.000Z",
      reason: "Support-approved emergency device switch",
      user_id: "user-1",
    });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "grant_cloud_sync_cooldown_override",
      target_id: "override-1",
      target_type: "cloud_sync_cooldown_override",
    }));
  });

  it("lets operators update user account status without reading passwords", async () => {
    const single = vi.fn(async () => ({ data: { account_status: "active" }, error: null }));
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select, update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_id", "user-1");
    formData.set("account_status", "disabled");

    await expect(updateUserAccountStatus(formData)).rejects.toThrow("redirect:/en/admin/users?notice=status-updated");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ account_status: "disabled", updated_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "update_user_account_status" }));
  });

  it("requires an owner before changing admin roles", async () => {
    const single = vi.fn(async () => ({ data: { admin_role: "user", is_admin: false }, error: null }));
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const eq = vi.fn<(column: string, value: string) => MutationResult>(async () => ({ error: null }));
    const update = vi.fn<(payload: unknown) => { eq: typeof eq }>(() => ({ eq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select, update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ja");
    formData.set("user_id", "user-1");
    formData.set("admin_role", "operator");

    await expect(updateUserAdminRole(formData)).rejects.toThrow("redirect:/ja/admin/users?notice=role-updated");

    expect(mocks.requireOwner).toHaveBeenCalledWith("ja");
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      admin_role: "operator",
      is_admin: false,
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/admin/users");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "update_user_admin_role" }));
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
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_code_redemptions") {
        return { select: redemptionSelect, update: redemptionUpdate };
      }

      if (table === "machine_trial_claims") {
        return { delete: claimDelete };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("trial_redemption_id", "redemption-1");

    await expect(unbindTrialMachine(formData)).rejects.toThrow("redirect:/en/admin/users?notice=trial-machine-unbound");

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
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "unbind_trial_machine" }));
  });
});
