import { beforeEach, describe, expect, it, vi } from "vitest";
import { addManualDonation, revokeCertificate } from "@/app/[locale]/admin/actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  generateCertificatesForDonation: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/certificates/service", () => ({
  generateCertificatesForDonation: mocks.generateCertificatesForDonation,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

describe("admin actions", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseAdminClient.mockReset();
    mocks.generateCertificatesForDonation.mockReset().mockResolvedValue({
      donationId: "donation-1",
      donationCertificateCreated: true,
      honorCertificateCreated: false,
    });
    mocks.revalidatePath.mockClear();
  });

  it("requires an admin before creating a manual donation and writes an audit log", async () => {
    const auditInsert = vi.fn(async () => ({ error: null }));
    const donationInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: "donation-1", user_id: "user-1", amount: 5000, status: "paid" },
          error: null,
        })),
      })),
    }));
    const profileSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "user-1", email: "user@example.com" }, error: null })),
      })),
    }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return { select: profileSelect };
      }

      if (table === "donations") {
        return { insert: donationInsert };
      }

      if (table === "admin_audit_logs") {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_identifier", "user@example.com");
    formData.set("amount", "5000");
    formData.set("reason", "Offline support received");

    await addManualDonation(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en");
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSupabaseAdminClient.mock.invocationCallOrder[0],
    );
    expect(donationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        amount: 5000,
        currency: "usd",
        provider: "manual",
        status: "paid",
      }),
    );
    expect(auditInsert).toHaveBeenCalledWith({
      admin_user_id: "admin-1",
      action: "add_manual_donation",
      target_type: "donation",
      target_id: "donation-1",
      before: null,
      after: { id: "donation-1", user_id: "user-1", amount: 5000, status: "paid" },
      reason: "Offline support received",
    });
    expect(mocks.generateCertificatesForDonation).toHaveBeenCalledWith("donation-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/donations");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/audit-logs");
  });

  it("requires a reason for manual donation creation", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("user_identifier", "user@example.com");
    formData.set("amount", "5000");
    formData.set("reason", " ");

    await expect(addManualDonation(formData)).rejects.toThrow("Reason is required");

    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("writes before and after JSON when revoking a certificate", async () => {
    const before = {
      id: "certificate-1",
      certificate_number: "DON-2026-000001",
      status: "active",
      revoked_at: null,
    };
    const after = {
      ...before,
      status: "revoked",
      revoked_at: "2026-04-30T10:00:00.000Z",
    };
    const insert = vi.fn(async () => ({ error: null }));
    const updateSelect = vi.fn(() => ({
      single: vi.fn(async () => ({ data: after, error: null })),
    }));
    const updateEq = vi.fn(() => ({ select: updateSelect }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const certificateSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: before, error: null })),
      })),
    }));
    const from = vi.fn((table: string) => {
      if (table === "certificates") {
        return { select: certificateSelect, update };
      }

      if (table === "admin_audit_logs") {
        return { insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("locale", "ko");
    formData.set("certificate_id", "certificate-1");
    formData.set("reason", "Refund confirmed");

    await revokeCertificate(formData);

    expect(mocks.requireAdmin).toHaveBeenCalledWith("ko");
    expect(update).toHaveBeenCalledWith({ status: "revoked", revoked_at: expect.any(String) });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ certificate_number: expect.anything() }));
    expect(insert).toHaveBeenCalledWith({
      admin_user_id: "admin-1",
      action: "revoke_certificate",
      target_type: "certificate",
      target_id: "certificate-1",
      before,
      after,
      reason: "Refund confirmed",
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
});
