import { beforeEach, describe, expect, it, vi } from "vitest";
import { addManualDonation, revokeCertificate } from "@/app/[locale]/admin/actions";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  generateCertificatesForDonation: vi.fn(),
  requireAdmin: vi.fn(),
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

function createProfileLookup(profile: { id: string; email: string } | null) {
  const single = vi.fn(async () => ({ data: profile, error: profile ? null : new Error("not found") }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));

  return { eq, select, single };
}

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

  it("requires an admin before creating a manual donation through the audited RPC", async () => {
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
});
