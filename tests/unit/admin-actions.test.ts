import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addManualDonation,
  bulkProcessUsers,
  createSoftwareRelease,
  createTrialCode,
  permanentlyDeleteUser,
  replySupportFeedbackAsAdmin,
  revokeCertificate,
  setSoftwareReleasePublished,
  softDeleteUser,
  updateDonationTier,
  updateSupportContactChannel,
  updateTrialCode,
  updateUserAccountStatus,
  updateUserAdminRole,
} from "@/app/[locale]/admin/actions";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  extendCloudSyncEntitlementForDonation: vi.fn(),
  generateCertificatesForDonation: vi.fn(),
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

vi.mock("@/lib/certificates/service", () => ({
  generateCertificatesForDonation: mocks.generateCertificatesForDonation,
}));

vi.mock("@/lib/license/entitlements", () => ({
  extendCloudSyncEntitlementForDonation: mocks.extendCloudSyncEntitlementForDonation,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

function createProfileLookup(profile: { id: string; email: string } | null) {
  const single = vi.fn(async () => ({ data: profile, error: profile ? null : new Error("not found") }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));

  return { eq, select, single };
}

describe("admin actions", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.requireOwner.mockReset().mockResolvedValue({ id: "owner-1" });
    mocks.createSupabaseAdminClient.mockReset();
    mocks.generateCertificatesForDonation.mockReset().mockResolvedValue({
      donationId: "donation-1",
      donationCertificateCreated: true,
      honorCertificateCreated: false,
    });
    mocks.extendCloudSyncEntitlementForDonation.mockReset().mockResolvedValue("2027-05-01T00:00:00.000Z");
    mocks.redirect.mockClear();
    mocks.revalidatePath.mockClear();
  });

  it("requires owner access before changing a user's admin role, audits it, and redirects with a success notice", async () => {
    const profileSingle = vi.fn(async () => ({ data: { admin_role: "user", is_admin: false }, error: null }));
    const profileEq = vi.fn(() => ({ single: profileSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: profileSelect, update };
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
    formData.set("admin_role", "operator");
    formData.set("return_to", "/admin/users");

    await expect(updateUserAdminRole(formData)).rejects.toThrow("redirect:/en/admin/users?notice=role-updated");

    expect(mocks.requireOwner).toHaveBeenCalledWith("en");
    expect(mocks.requireOwner.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSupabaseAdminClient.mock.invocationCallOrder[0],
    );
    expect(update).toHaveBeenCalledWith({
      admin_role: "operator",
      is_admin: false,
      updated_at: expect.any(String),
    });
    expect(updateEq).toHaveBeenCalledWith("id", "user-1");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_user_admin_role",
      admin_user_id: "owner-1",
      target_id: "user-1",
      target_type: "profile",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users/user-1");
  });

  it("redirects with an error when updating a user's admin role fails", async () => {
    const profileSingle = vi.fn(async () => ({ data: { admin_role: "user", is_admin: false }, error: null }));
    const profileEq = vi.fn(() => ({ single: profileSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));
    const updateEq = vi.fn(async () => ({ error: new Error("database down") }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: profileSelect, update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_id", "user-1");
    formData.set("admin_role", "operator");
    formData.set("return_to", "https://evil.example/admin/users");

    await expect(updateUserAdminRole(formData)).rejects.toThrow("redirect:/en/admin/users?error=role-update-failed");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/en/admin/users");
  });

  it("audits account status changes and redirects with a success notice", async () => {
    const profileSingle = vi.fn(async () => ({ data: { account_status: "active" }, error: null }));
    const profileEq = vi.fn(() => ({ single: profileSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: profileSelect, update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "zh-Hant");
    formData.set("user_id", "user-1");
    formData.set("account_status", "disabled");
    formData.set("return_to", "/admin/users/user-1");

    await expect(updateUserAccountStatus(formData)).rejects.toThrow("redirect:/zh-Hant/admin/users/user-1?notice=status-updated");

    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_user_account_status",
      admin_user_id: "admin-1",
      target_id: "user-1",
      target_type: "profile",
    }));
  });

  it("soft deletes one user and audits the action", async () => {
    const profileSingle = vi.fn(async () => ({ data: { account_status: "active", email: "user@example.com" }, error: null }));
    const profileEq = vi.fn(() => ({ single: profileSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: profileSelect, update };
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
    formData.set("return_to", "/admin/users");

    await expect(softDeleteUser(formData)).rejects.toThrow("redirect:/en/admin/users?notice=user-soft-deleted");

    expect(update).toHaveBeenCalledWith({
      account_status: "deleted",
      updated_at: expect.any(String),
    });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "soft_delete_user",
      admin_user_id: "admin-1",
      target_id: "user-1",
      target_type: "profile",
    }));
  });

  it.each([
    ["enable", "active"],
    ["disable", "disabled"],
    ["soft-delete", "deleted"],
  ])("bulk updates account status to %s for multiple users", async (intent, accountStatus) => {
    const updateIn = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ in: updateIn }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.append("user_ids", "user-1");
    formData.append("user_ids", "user-2");
    formData.set("intent", intent);

    await expect(bulkProcessUsers(formData)).rejects.toThrow("redirect:/en/admin/users?notice=bulk-user-status-updated");

    expect(update).toHaveBeenCalledWith({
      account_status: accountStatus,
      updated_at: expect.any(String),
    });
    expect(updateIn).toHaveBeenCalledWith("id", ["user-1", "user-2"]);
  });

  it("bulk updates user admin roles through owner access", async () => {
    const updateIn = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ in: updateIn }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.append("user_ids", "user-1");
    formData.append("user_ids", "user-2");
    formData.set("intent", "change-role");
    formData.set("admin_role", "operator");

    await expect(bulkProcessUsers(formData)).rejects.toThrow("redirect:/en/admin/users?notice=bulk-user-role-updated");

    expect(mocks.requireOwner).toHaveBeenCalledWith("en");
    expect(update).toHaveBeenCalledWith({
      admin_role: "operator",
      is_admin: false,
      updated_at: expect.any(String),
    });
    expect(updateIn).toHaveBeenCalledWith("id", ["user-1", "user-2"]);
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      after: expect.objectContaining({
        user_ids: ["user-1", "user-2"],
      }),
      target_id: "user-1",
      target_type: "profile_batch",
    }));
  });

  it.each(["", "not-a-role"])("redirects with feedback when bulk role value is invalid: %s", async (adminRole) => {
    const update = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { update };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.append("user_ids", "user-1");
    formData.set("intent", "change-role");
    if (adminRole) {
      formData.set("admin_role", adminRole);
    }

    await expect(bulkProcessUsers(formData)).rejects.toThrow("redirect:/en/admin/users?error=bulk-user-role-update-failed");

    expect(mocks.requireOwner).toHaveBeenCalledWith("en");
    expect(update).not.toHaveBeenCalled();
  });

  it("permanently deletes a user after confirmation and audits the action", async () => {
    const profileSingle = vi.fn(async () => ({ data: { email: "user@example.com" }, error: null }));
    const profileEq = vi.fn(() => ({ single: profileSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));
    const deleteEq = vi.fn(async () => ({ error: null }));
    const deleteFrom = vi.fn(() => ({ eq: deleteEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { delete: deleteFrom, select: profileSelect };
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
    formData.set("confirmation", "user@example.com");

    await expect(permanentlyDeleteUser(formData)).rejects.toThrow("redirect:/en/admin/users?notice=user-permanently-deleted");

    expect(mocks.requireOwner).toHaveBeenCalledWith("en");
    expect(deleteEq).toHaveBeenCalledWith("id", "user-1");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "permanently_delete_user",
      admin_user_id: "owner-1",
      target_id: "user-1",
      target_type: "profile",
    }));
  });

  it("requires an admin before creating a manual donation through the audited RPC and extends entitlement", async () => {
    const profileLookup = createProfileLookup({ id: "user-1", email: "user@example.com" });
    const rpc = vi.fn(async () => ({ data: "donation-1", error: null }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: profileLookup.select };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from, rpc });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_identifier", "user@example.com");
    formData.set("amount", "5000");
    formData.set("reference", "offline receipt #42");
    formData.set("reason", "Offline support received");

    await expect(addManualDonation(formData)).rejects.toThrow("redirect:/en/admin/donations?notice=manual-donation-added");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSupabaseAdminClient.mock.invocationCallOrder[0],
    );
    expect(rpc).toHaveBeenCalledWith("create_manual_paid_donation_with_audit", {
      input_admin_user_id: "admin-1",
      input_amount: 5000,
      input_currency: "usd",
      input_provider_transaction_id: "manual_offline-receipt-42",
      input_reason: "Offline support received",
      input_user_id: "user-1",
    });
    expect(mocks.generateCertificatesForDonation).toHaveBeenCalledWith("donation-1");
    expect(mocks.extendCloudSyncEntitlementForDonation).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: "user-1",
        donationId: "donation-1",
        tierCode: "yearly",
        paidAt: expect.any(Date),
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/donations");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/certificates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/audit-logs");
  });

  it("updates a support contact channel and redirects with a success notice", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const selectSingle = vi.fn(async () => ({ data: { id: "telegram" }, error: null }));
    const selectEq = vi.fn(() => ({ single: selectSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const from = vi.fn((table: string) => {
      if (table === "support_contact_channels") {
        return { select, upsert };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("return_to", "/admin/support-settings");
    formData.set("channel_id", "telegram");
    formData.set("label", "Telegram");
    formData.set("value", "https://t.me/example");
    formData.set("sort_order", "10");
    formData.set("is_enabled", "on");

    await expect(updateSupportContactChannel(formData)).rejects.toThrow("redirect:/en/admin/support-settings?notice=support-contact-updated");

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "telegram",
      is_enabled: true,
      label: "Telegram",
      sort_order: 10,
      updated_by: "admin-1",
      value: "https://t.me/example",
    }), { onConflict: "id" });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      target_id: "11111111-1111-1111-1111-111111111111",
    }));
  });

  it("creates a missing support contact channel row through upsert", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const selectSingle = vi.fn(async () => ({ data: null, error: null }));
    const selectEq = vi.fn(() => ({ single: selectSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const from = vi.fn((table: string) => {
      if (table === "support_contact_channels") {
        return { select, upsert };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("return_to", "/admin/support-settings");
    formData.set("channel_id", "email");
    formData.set("label", "Email");
    formData.set("value", "support@example.com");
    formData.set("sort_order", "40");
    formData.set("is_enabled", "on");

    await expect(updateSupportContactChannel(formData)).rejects.toThrow("redirect:/en/admin/support-settings?notice=support-contact-updated");

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "email",
      value: "support@example.com",
    }), { onConflict: "id" });
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("rejects invalid support contact values before writing", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("channel_id", "telegram");
    formData.set("label", "Telegram");
    formData.set("value", "telegram-user");
    formData.set("sort_order", "10");
    formData.set("is_enabled", "on");

    await expect(updateSupportContactChannel(formData)).rejects.toThrow("Enter a valid URL");
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("updates a development support tier and audits the change", async () => {
    const tierSingle = vi.fn(async () => ({
      data: {
        amount: 900,
        compare_at_amount: null,
        description: "Old monthly copy",
        is_active: true,
        label: "Monthly Support",
      },
      error: null,
    }));
    const tierEqSingle = vi.fn(() => ({ single: tierSingle }));
    const tierSelect = vi.fn(() => ({ eq: tierEqSingle }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "donation_tiers") {
        return { select: tierSelect, update };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("return_to", "/admin/support-settings");
    formData.set("tier_id", "tier-monthly");
    formData.set("label", "Monthly Support");
    formData.set("description", "New monthly copy");
    formData.set("amount", "900");
    formData.set("compare_at_amount", "");
    formData.set("is_active", "on");

    await expect(updateDonationTier(formData)).rejects.toThrow("redirect:/en/admin/support-settings?notice=donation-tier-updated");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      amount: 900,
      compare_at_amount: null,
      description: "New monthly copy",
      is_active: true,
      label: "Monthly Support",
      updated_at: expect.any(String),
    }));
    expect(updateEq).toHaveBeenCalledWith("id", "tier-monthly");
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_donation_tier",
      target_id: "tier-monthly",
      target_type: "donation_tier",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/contributions");
  });

  it("requires a stable manual reference for idempotent manual donation creation", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_identifier", "user@example.com");
    formData.set("amount", "5000");
    formData.set("reason", "Offline support received");

    await expect(addManualDonation(formData)).rejects.toThrow("Reference is required");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("requires bounded reasons before creating a manual donation", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_identifier", "user@example.com");
    formData.set("amount", "5000");
    formData.set("reference", "offline-42");
    formData.set("reason", "x".repeat(501));

    await expect(addManualDonation(formData)).rejects.toThrow("Reason must be 500 characters or fewer");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("stores admin support replies and audits the action", async () => {
    const messageInsert = vi.fn(async () => ({ error: null }));
    const feedbackEq = vi.fn(async () => ({ error: null }));
    const feedbackUpdate = vi.fn(() => ({ eq: feedbackEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "support_feedback_messages") {
        return { insert: messageInsert };
      }

      if (table === "support_feedback") {
        return { update: feedbackUpdate };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("feedback_id", "feedback-1");
    formData.set("message", "We checked your account and fixed the issue.");

    await expect(replySupportFeedbackAsAdmin(formData)).rejects.toThrow("redirect:/en/admin/support-feedback/feedback-1?notice=feedback-replied");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(messageInsert).toHaveBeenCalledWith({
      admin_user_id: "admin-1",
      author_role: "admin",
      body: "We checked your account and fixed the issue.",
      feedback_id: "feedback-1",
    });
    expect(feedbackUpdate).toHaveBeenCalledWith({ status: "reviewing", updated_at: expect.any(String) });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "reply_support_feedback",
      admin_user_id: "admin-1",
      target_id: "feedback-1",
      target_type: "support_feedback",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/support-feedback/feedback-1");
  });

  it("revokes certificates through the audited RPC", async () => {
    const rpc = vi.fn(async () => ({ data: "certificate-1", error: null }));
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("certificate_id", "certificate-1");
    formData.set("reason", "Refund confirmed");

    await expect(revokeCertificate(formData)).rejects.toThrow("redirect:/ko/admin/certificates?notice=certificate-revoked");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("ko");
    expect(rpc).toHaveBeenCalledWith("revoke_certificate_with_audit", {
      input_admin_user_id: "admin-1",
      input_certificate_id: "certificate-1",
      input_reason: "Refund confirmed",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ko/admin/certificates");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ko/admin/audit-logs");
  });

  it("requires a reason before revoking a certificate", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("certificate_id", "certificate-1");

    await expect(revokeCertificate(formData)).rejects.toThrow("Reason is required");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("creates a software release, uploads platform assets, and revalidates public download pages", async () => {
    const releaseInsertSingle = vi.fn(async () => ({ data: { id: "release-1" }, error: null }));
    const releaseSelect = vi.fn(() => ({ single: releaseInsertSingle }));
    const releaseInsert = vi.fn(() => ({ select: releaseSelect }));
    const assetInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "software_releases") {
        return { insert: releaseInsert };
      }

      if (table === "software_release_assets") {
        return { insert: assetInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    const upload = vi.fn(async () => ({ error: null }));
    const storageFrom = vi.fn(() => ({ upload }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from, storage: { from: storageFrom } });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("version", "v1.2.0");
    formData.set("released_at", "2026-04-30");
    formData.set("notes", "Fast AI indexing");
    formData.set("delivery_mode", "file");
    formData.set("is_published", "on");
    formData.set("macos_file", new File(["mac"], "GitBook AI.dmg"));
    formData.set("windows_file", new File(["win"], "GitBook AI.exe"));

    await expect(createSoftwareRelease(formData)).rejects.toThrow("redirect:/en/admin/releases?notice=release-created");

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(releaseInsert).toHaveBeenCalledWith({
      created_by: "admin-1",
      delivery_mode: "file",
      is_published: true,
      macos_backup_url: null,
      macos_primary_url: null,
      notes: "Fast AI indexing",
      released_at: "2026-04-30",
      version: "v1.2.0",
      windows_backup_url: null,
      windows_primary_url: null,
    });
    expect(storageFrom).toHaveBeenCalledWith("software-releases");
    expect(upload).toHaveBeenCalledTimes(2);
    expect(assetInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ file_name: "GitBook AI.dmg", platform: "macos", release_id: "release-1" }),
        expect.objectContaining({ file_name: "GitBook AI.exe", platform: "windows", release_id: "release-1" }),
      ]),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/versions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/releases");
  });

  it("creates a software release in link mode without writing release assets", async () => {
    const releaseInsertSingle = vi.fn(async () => ({ data: { id: "release-1" }, error: null }));
    const releaseSelect = vi.fn(() => ({ single: releaseInsertSingle }));
    const releaseInsert = vi.fn(() => ({ select: releaseSelect }));
    const assetInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "software_releases") {
        return { insert: releaseInsert };
      }

      if (table === "software_release_assets") {
        return { insert: assetInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from, storage: { from: vi.fn() } });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("version", "v1.3.0");
    formData.set("released_at", "2026-05-01");
    formData.set("delivery_mode", "link");
    formData.set("macos_primary_url", "https://downloads.example/mac.dmg");
    formData.set("macos_backup_url", "https://mirror.example/mac.dmg");
    formData.set("windows_primary_url", "https://downloads.example/win.exe");
    formData.set("windows_backup_url", "https://mirror.example/win.exe");

    await expect(createSoftwareRelease(formData)).rejects.toThrow("redirect:/en/admin/releases?notice=release-created");

    expect(releaseInsert).toHaveBeenCalledWith(expect.objectContaining({
      delivery_mode: "link",
      macos_primary_url: "https://downloads.example/mac.dmg",
      macos_backup_url: "https://mirror.example/mac.dmg",
      windows_primary_url: "https://downloads.example/win.exe",
      windows_backup_url: "https://mirror.example/win.exe",
    }));
    expect(assetInsert).not.toHaveBeenCalled();
  });

  it("rejects duplicate backup and primary URLs for the same platform", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("version", "v1.3.0");
    formData.set("released_at", "2026-05-01");
    formData.set("delivery_mode", "link");
    formData.set("macos_primary_url", "https://downloads.example/mac.dmg");
    formData.set("macos_backup_url", "https://downloads.example/mac.dmg");
    formData.set("windows_primary_url", "https://downloads.example/win.exe");

    await expect(createSoftwareRelease(formData)).rejects.toThrow("Backup URL must be different from the primary URL");
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("publishes and unpublishes a software release", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ja");
    formData.set("release_id", "release-1");
    formData.set("is_published", "false");

    await expect(setSoftwareReleasePublished(formData)).rejects.toThrow("redirect:/ja/admin/releases?notice=release-updated");

    expect(update).toHaveBeenCalledWith({ is_published: false });
    expect(eq).toHaveBeenCalledWith("id", "release-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/versions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/admin/releases");
  });

  it("audits trial code creation and redirects back to licenses", async () => {
    vi.stubEnv("LICENSE_CODE_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    vi.stubEnv("LICENSE_HASH_SALT", "test-license-salt");
    const trialSingle = vi.fn(async () => ({
      data: {
        code_mask: "ABCD-****-****-WXYZ",
        id: "trial-1",
        label: "May support trial",
        trial_days: 3,
      },
      error: null,
    }));
    const trialSelect = vi.fn(() => ({ single: trialSingle }));
    const trialInsert = vi.fn(() => ({ select: trialSelect }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { insert: trialInsert };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("label", "May support trial");
    formData.set("trial_days", "3");

    await expect(createTrialCode(formData)).rejects.toThrow("redirect:/en/admin/licenses?notice=trial-code-created");

    expect(trialInsert).toHaveBeenCalledWith(expect.objectContaining({
      duration_kind: "trial_3_day",
      label: "May support trial",
      max_redemptions: 1,
      trial_days: 3,
    }));
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "create_trial_code",
      admin_user_id: "admin-1",
      target_type: "trial_code",
    }));
    vi.unstubAllEnvs();
  });

  it("audits trial code edits and redirects with a success notice", async () => {
    const trialSingle = vi.fn(async () => ({ data: { label: "Old", trial_days: 3 }, error: null }));
    const trialSelectEq = vi.fn(() => ({ single: trialSingle }));
    const trialSelect = vi.fn(() => ({ eq: trialSelectEq }));
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return { select: trialSelect, update };
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
    formData.set("label", "New");
    formData.set("trial_days", "7");

    await expect(updateTrialCode(formData)).rejects.toThrow("redirect:/en/admin/licenses?notice=trial-code-updated");

    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_trial_code",
      admin_user_id: "admin-1",
      target_id: "trial-1",
      target_type: "trial_code",
    }));
  });
});
