import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[locale]/dashboard/certificates/[id]/download/[format]/route";
import { getCertificateExportFilename, renderCertificateSvg } from "@/lib/certificates/export";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: "certificate") => {
    const messages = {
      brand: "Three Friends",
      title: "支援証明書",
      description: "独立したソフトウェア開発への大切なご支援に、感謝を込めてこの証明書を贈ります。",
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
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: mocks.maybeSingle,
    select: vi.fn(() => query),
  };

  return {
    from: vi.fn(() => query),
    query,
  };
}

function params(format = "svg") {
  return Promise.resolve({ id: "cert-1", locale: "ja", format });
}

describe("certificate export route", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.getUser.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
  });

  it("redirects unauthenticated users to localized login with the certificate download path", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(createAuthClient(null));

    await expect(
      GET(new Request("https://threefriends.example/ja/dashboard/certificates/cert-1/download/svg"), {
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
      GET(new Request("https://threefriends.example/ja/dashboard/certificates/cert-1/download/svg"), {
        params: params(),
      }),
    ).rejects.toThrow("notFound");

    expect(certificateClient.from).toHaveBeenCalledWith("certificates");
    expect(certificateClient.query.eq).toHaveBeenCalledWith("id", "cert-1");
    expect(certificateClient.query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(certificateClient.query.eq).toHaveBeenCalledWith("status", "active");
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
        certificate_number: "TF-DON-2026-0001",
        issued_at: "2026-04-30T00:00:00.000Z",
        type: "donation",
      },
      error: null,
    });

    const response = await GET(
      new Request("https://threefriends.example/ja/dashboard/certificates/cert-1/download/svg"),
      { params: params() },
    );
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="three-friends-certificate-TF-DON-2026-0001.svg"',
    );
    expect(body).toContain("<svg");
    expect(body).toContain("Three Friends");
    expect(body).toContain("支援証明書");
    expect(body).toContain("Ada Lovelace");
    expect(body).toContain("TF-DON-2026-0001");
    expect(body).toContain("寄付証明書");
    expect(body).toContain("2026年4月30日");
  });

  it("does not advertise unsupported binary formats", async () => {
    await expect(
      GET(new Request("https://threefriends.example/ja/dashboard/certificates/cert-1/download/png"), {
        params: params("png"),
      }),
    ).rejects.toThrow("notFound");

    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("escapes SVG text content from certificate fields and recipient names", () => {
    const body = renderCertificateSvg({
      certificateNumber: "TFD-2026-D-<001>",
      copy: {
        brand: "Three & Friends",
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
      recipientName: "<script>alert('x')</script>",
    });

    expect(body).toContain("Three &amp; Friends");
    expect(body).toContain("Support &lt;Certificate&gt;");
    expect(body).toContain("Thank &lt;you&gt; &amp; &quot;friends&quot;");
    expect(body).toContain("&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt;");
    expect(body).not.toContain("<script>");
  });

  it("sanitizes certificate numbers before using them in attachment filenames", () => {
    expect(getCertificateExportFilename('TFD/2026 "<D>" 001', "svg")).toBe(
      "three-friends-certificate-TFD-2026-D-001.svg",
    );
  });
});
