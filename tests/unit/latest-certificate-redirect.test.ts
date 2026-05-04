import { beforeEach, describe, expect, it, vi } from "vitest";
import LatestCertificatePage from "@/app/[locale]/dashboard/certificates/latest/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  donationMaybeSingle: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  requireUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

function createCertificateClient() {
  const certificateQuery = {
    eq: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: mocks.maybeSingle,
    order: vi.fn(() => query),
    select: vi.fn(() => query),
  };

  const donationQuery = {
    eq: vi.fn(() => donationQuery),
    gte: vi.fn(() => donationQuery),
    limit: vi.fn(() => donationQuery),
    maybeSingle: mocks.donationMaybeSingle,
    order: vi.fn(() => donationQuery),
    select: vi.fn(() => donationQuery),
  };

  const query = certificateQuery;

  return {
    from: vi.fn((table: string) => {
      if (table === "certificates") return certificateQuery;
      if (table === "donations") return donationQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
    certificateQuery,
    donationQuery,
  };
}

describe("latest certificate redirect page", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.donationMaybeSingle.mockReset();
    mocks.donationMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.maybeSingle.mockReset();
    mocks.redirect.mockClear();
    mocks.requireUser.mockReset().mockResolvedValue({ id: "user-1" });
  });

  it("redirects to the newest active donation certificate for the signed-in user", async () => {
    const client = createCertificateClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);
    mocks.maybeSingle.mockResolvedValue({ data: { id: "cert-1" }, error: null });

    await expect(
      LatestCertificatePage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("redirect:/en/dashboard/certificates/cert-1?payment=dodo-success");

    expect(client.from).toHaveBeenCalledWith("certificates");
    expect(client.certificateQuery.select).toHaveBeenCalledWith("id");
    expect(client.certificateQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(client.certificateQuery.eq).toHaveBeenCalledWith("type", "donation");
    expect(client.certificateQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(client.certificateQuery.order).toHaveBeenCalledWith("issued_at", { ascending: false });
    expect(client.certificateQuery.limit).toHaveBeenCalledWith(1);
  });

  it("falls back to dashboard when no generated certificate is available yet", async () => {
    const client = createCertificateClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      LatestCertificatePage({ params: Promise.resolve({ locale: "zh-Hant" }) }),
    ).rejects.toThrow("redirect:/zh-Hant/dashboard?payment=dodo-success");
  });

  it("does not redirect to an older certificate when the current checkout has not produced a new paid record yet", async () => {
    const client = createCertificateClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);
    mocks.donationMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      LatestCertificatePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ checkout_started_at: "2026-05-04T10:00:00.000Z", payment: "dodo-success" }),
      } as {
        params: Promise<{ locale: string }>;
        searchParams: Promise<{ checkout_started_at: string; payment: string }>;
      }),
    ).rejects.toThrow("redirect:/en/dashboard?payment=dodo-success");

    expect(client.from).toHaveBeenCalledWith("donations");
    expect(client.donationQuery.gte).toHaveBeenCalledWith("paid_at", "2026-05-04T10:00:00.000Z");
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it("waits for a newly paid donation certificate instead of falling back immediately when the donation exists", async () => {
    const client = createCertificateClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);
    mocks.donationMaybeSingle.mockResolvedValue({ data: { id: "donation-2" }, error: null });
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "cert-2" }, error: null });

    await expect(
      LatestCertificatePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ checkout_started_at: "2026-05-04T10:00:00.000Z", payment: "dodo-success" }),
      } as {
        params: Promise<{ locale: string }>;
        searchParams: Promise<{ checkout_started_at: string; payment: string }>;
      }),
    ).rejects.toThrow("redirect:/en/dashboard/certificates/cert-2?payment=dodo-success");

    expect(mocks.maybeSingle).toHaveBeenCalledTimes(2);
  });
});
