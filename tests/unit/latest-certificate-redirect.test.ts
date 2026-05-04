import { beforeEach, describe, expect, it, vi } from "vitest";
import LatestCertificatePage from "@/app/[locale]/dashboard/certificates/latest/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
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
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: mocks.maybeSingle,
    order: vi.fn(() => query),
    select: vi.fn(() => query),
  };

  return { from: vi.fn(() => query), query };
}

describe("latest certificate redirect page", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
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
    expect(client.query.select).toHaveBeenCalledWith("id");
    expect(client.query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(client.query.eq).toHaveBeenCalledWith("type", "donation");
    expect(client.query.eq).toHaveBeenCalledWith("status", "active");
    expect(client.query.order).toHaveBeenCalledWith("issued_at", { ascending: false });
    expect(client.query.limit).toHaveBeenCalledWith(1);
  });

  it("falls back to dashboard when no generated certificate is available yet", async () => {
    const client = createCertificateClient();
    mocks.createSupabaseServerClient.mockResolvedValue(client);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      LatestCertificatePage({ params: Promise.resolve({ locale: "zh-Hant" }) }),
    ).rejects.toThrow("redirect:/zh-Hant/dashboard?payment=dodo-success");
  });
});
