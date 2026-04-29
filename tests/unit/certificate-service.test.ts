import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCertificatesForDonation } from "@/lib/certificates/service";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

type QueryResult = { data: unknown; error: null | { code?: string; message: string } };

function query(result: QueryResult) {
  return {
    eq: vi.fn(() => query(result)),
    maybeSingle: vi.fn(async () => result),
    select: vi.fn(() => query(result)),
    single: vi.fn(async () => result),
  };
}

describe("generateCertificatesForDonation", () => {
  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset();
    mocks.rpc.mockReset();
    mocks.insert.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("skips donation certificate allocation when a donation certificate already exists", async () => {
    const paidDonation = { id: "donation_123", user_id: "user_123" };
    const existingDonationCertificate = { id: "certificate_123" };

    mocks.rpc.mockResolvedValue({ data: 499, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "donations") {
          return query({ data: paidDonation, error: null });
        }

        if (table === "certificates") {
          return query({ data: existingDonationCertificate, error: null });
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: mocks.rpc,
    });

    await expect(generateCertificatesForDonation("donation_123")).resolves.toEqual({
      donationId: "donation_123",
      donationCertificateCreated: false,
      honorCertificateCreated: false,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("get_paid_total", { input_user_id: "user_123" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("allocate_certificate_number", expect.anything());
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
