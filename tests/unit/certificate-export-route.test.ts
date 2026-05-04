import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[locale]/dashboard/certificates/[id]/download/[format]/route";
import { getCertificateExportFilename, renderCertificateSvg } from "@/lib/certificates/export";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  cookies: vi.fn(),
  donationMaybeSingle: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  tierMaybeSingle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: "certificate") => {
    const messages = {
      brand: "GitBook AI",
      title: "支援証明書",
      description: "独立したソフトウェア開発への大切なご支援に、感謝を込めてこの証明書を贈ります。",
      amount: "寄付金額",
      presentedTo: "贈呈先",
      certificateNumber: "証明書番号",
      issued: "発行日",
      pendingIssueDate: "発行日未定",
      fallbackRecipient: "サポーター",
      types: {
        donation: "寄付証明書",
        honor: "表彰証明書",
      },
      download: {
        svg: "SVGをダウンロード",
      },
    };

    return (key: string) => {
      const value = key.split(".").reduce<unknown>((current, segment) => {
        if (current && typeof current === "object" && segment in current) {
          return (current as Record<string, unknown>)[segment];
        }

        return undefined;
      }, messages);

      if (typeof value !== "string") {
        throw new Error(`Missing test message: ${namespace}.${key}`);
      }

      return value;
    };
  }),
  setRequestLocale: vi.fn(),
}));

function createAuthClient(user: unknown) {
  return {
    auth: {
      getUser: mocks.getUser.mockResolvedValue({ data: { user } }),
    },
  };
}

function createCertificateClient() {
  const certificateQuery = {
    eq: vi.fn(() => certificateQuery),
    maybeSingle: mocks.maybeSingle,
    select: vi.fn(() => certificateQuery),
  };
  const donationQuery = {
    eq: vi.fn(() => donationQuery),
    maybeSingle: mocks.donationMaybeSingle,
    select: vi.fn(() => donationQuery),
  };
  const tierQuery = {
    eq: vi.fn(() => tierQuery),
    maybeSingle: mocks.tierMaybeSingle,
    select: vi.fn(() => tierQuery),
  };

  return {
    certificateQuery,
    from: vi.fn((table: string) => {
      if (table === "donations") {
        return donationQuery;
      }

      if (table === "donation_tiers") {
        return tierQuery;
      }

      return certificateQuery;
    }),
  };
}

function params(format = "svg") {
  return Promise.resolve({ id: "cert-1", locale: "ja", format });
}

describe("certificate export route", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.cookies.mockReset();
    mocks.cookies.mockResolvedValue({
      getAll: vi.fn(() => [{ name: "sb-test-auth-token", value: "token" }]),
    });
    mocks.donationMaybeSingle.mockReset();
    mocks.getUser.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    mocks.tierMaybeSingle.mockReset();
  });

  it("redirects unauthenticated users to localized login with the certificate download path", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(createAuthClient(null));

    await expect(
      GET(new Request("https://gitbookai.example/ja/dashboard/certificates/cert-1/download/svg"), {
        params: params(),
      }),
    ).rejects.toThrow("redirect:/ja/login?next=%2Fja%2Fdashboard%2Fcertificates%2Fcert-1%2Fdownload%2Fsvg");

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/ja/login?next=%2Fja%2Fdashboard%2Fcertificates%2Fcert-1%2Fdownload%2Fsvg",
    );
  });

  it("returns 404 when the active certificate does not belong to the current user", async () => {
    const certificateClient = createCertificateClient();
    mocks.createSupabaseServerClient
      .mockResolvedValueOnce(createAuthClient({ id: "user-1", email: "ada@example.com", user_metadata: {} }))
      .mockResolvedValueOnce(certificateClient);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      GET(new Request("https://gitbookai.example/ja/dashboard/certificates/cert-1/download/svg"), {
        params: params(),
      }),
    ).rejects.toThrow("notFound");

    expect(certificateClient.from).toHaveBeenCalledWith("certificates");
    expect(certificateClient.certificateQuery.eq).toHaveBeenCalledWith("id", "cert-1");
    expect(certificateClient.certificateQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(certificateClient.certificateQuery.eq).toHaveBeenCalledWith("status", "active");
  });

  it("downloads a localized SVG certificate with attachment headers", async () => {
    const certificateClient = createCertificateClient();
    mocks.createSupabaseServerClient
      .mockResolvedValueOnce(
        createAuthClient({
          id: "user-1",
          email: "ada@example.com",
          user_metadata: { full_name: "Ada Lovelace" },
        }),
      )
      .mockResolvedValueOnce(certificateClient);
    mocks.maybeSingle.mockResolvedValue({
      data: {
        certificate_number: "GBAI-2026-D-000001",
        donation_id: "donation-1",
        issued_at: "2026-04-30T00:00:00.000Z",
        type: "donation",
      },
      error: null,
    });
    mocks.donationMaybeSingle.mockResolvedValue({ data: { amount: 1500, currency: "usd", tier_id: "tier-quarterly" }, error: null });
    mocks.tierMaybeSingle.mockResolvedValue({ data: { code: "quarterly" }, error: null });

    const response = await GET(
      new Request("https://gitbookai.example/ja/dashboard/certificates/cert-1/download/svg"),
      { params: params() },
    );
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="gitbook-ai-certificate-GBAI-2026-D-000001.svg"',
    );
    expect(body).toContain("<svg");
    expect(body).toContain('data-certificate-template="quarterly"');
    expect(body).toContain("data:image/webp;base64,");
    expect(body).toContain("GitBook AI");
    expect(body).toContain("支援証明書");
    expect(body).toContain("Ada Lovelace");
    expect(body).toContain("GBAI-2026-D-000001");
    expect(body).toContain("寄付証明書");
    expect(body).toContain("$15.00");
    expect(body).toContain("2026年4月30日 00:00:00 UTC");
  });

  it("does not advertise unsupported binary formats", async () => {
    await expect(
      GET(new Request("https://gitbookai.example/ja/dashboard/certificates/cert-1/download/png"), {
        params: params("png"),
      }),
    ).rejects.toThrow("notFound");

    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("escapes SVG text content from certificate fields and recipient names", () => {
    const body = renderCertificateSvg({
      certificateNumber: "GBAI-2026-D-<001>",
      copy: {
        amount: "Amount",
        brand: "GitBook & AI",
        certificateNumber: "Certificate No.",
        description: "Thank <you> & \"friends\"",
        issued: "Issued",
        pendingIssueDate: "Pending",
        presentedTo: "Presented to",
        title: "Support <Certificate>",
      },
      issuedAt: null,
      label: "Donation & Honor",
      locale: "en",
      donationAmount: "$5.00",
      recipientName: "<script>alert('x')</script>",
      template: {
        accent: "#22d3ee",
        backgroundUrl: "/certificates/monthly-bg.webp",
        code: "monthly",
        foil: "#fef3c7",
        panelFill: "rgba(15, 23, 42, 0.72)",
        panelStroke: "rgba(125, 211, 252, 0.32)",
        text: "#ffffff",
        textMuted: "#cbd5e1",
      },
      templateBackgroundDataUri: "data:image/webp;base64,dGVzdA==",
    });

    expect(body).toContain('data-certificate-template="monthly"');
    expect(body).toContain("data:image/webp;base64,dGVzdA==");
    expect(body).toContain("GitBook &amp; AI");
    expect(body).toContain("$5.00");
    expect(body).toContain("Support &lt;Certificate&gt;");
    expect(body).toContain("Thank &lt;you&gt; &amp; &quot;friends&quot;");
    expect(body).toContain("&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt;");
    expect(body).not.toContain("<script>");
  });

  it("sanitizes certificate numbers before using them in attachment filenames", () => {
    expect(getCertificateExportFilename('GBAI/2026 "<D>" 001', "svg")).toBe(
      "gitbook-ai-certificate-GBAI-2026-D-001.svg",
    );
  });
});
