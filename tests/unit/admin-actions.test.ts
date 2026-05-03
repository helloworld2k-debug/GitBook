import { beforeEach, describe, expect, it, vi } from "vitest";
import { addManualDonation, createSoftwareRelease, replySupportFeedbackAsAdmin, revokeCertificate, setSoftwareReleasePublished, updateUserAdminRole } from "@/app/[locale]/admin/actions";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  extendCloudSyncEntitlementForDonation: vi.fn(),
  generateCertificatesForDonation: vi.fn(),
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

vi.mock("@/lib/certificates/service", () => ({
  generateCertificatesForDonation: mocks.generateCertificatesForDonation,
}));

vi.mock("@/lib/license/entitlements", () => ({
  extendCloudSyncEntitlementForDonation: mocks.extendCloudSyncEntitlementForDonation,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
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
    mocks.revalidatePath.mockClear();
  });

  it("requires owner access before changing a user's admin role", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_id", "user-1");
    formData.set("admin_role", "operator");

    await updateUserAdminRole(formData);

    expect(mocks.requireOwner).toHaveBeenCalledWith("en");
    expect(mocks.requireOwner.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSupabaseAdminClient.mock.invocationCallOrder[0],
    );
    expect(update).toHaveBeenCalledWith({
      admin_role: "operator",
      is_admin: false,
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/users/user-1");
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

    await addManualDonation(formData);

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

    await replySupportFeedbackAsAdmin(formData);

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

    await revokeCertificate(formData);

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
    formData.set("is_published", "on");
    formData.set("macos_file", new File(["mac"], "GitBook AI.dmg"));
    formData.set("windows_file", new File(["win"], "GitBook AI.exe"));

    await createSoftwareRelease(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(releaseInsert).toHaveBeenCalledWith({
      created_by: "admin-1",
      is_published: true,
      notes: "Fast AI indexing",
      released_at: "2026-04-30",
      version: "v1.2.0",
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

  it("publishes and unpublishes a software release", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ja");
    formData.set("release_id", "release-1");
    formData.set("is_published", "false");

    await setSoftwareReleasePublished(formData);

    expect(update).toHaveBeenCalledWith({ is_published: false });
    expect(eq).toHaveBeenCalledWith("id", "release-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/versions");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ja/admin/releases");
  });
});
