import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CertificatePage from "@/app/[locale]/dashboard/certificates/[id]/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  donationMaybeSingle: vi.fn(),
  maybeSingle: vi.fn(),
  requireUser: vi.fn(),
  tierMaybeSingle: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: "certificate") => {
    const messages = {
      brand: "GitBook AI",
      title: "후원 인증서",
      description: "독립 소프트웨어 개발을 위한 의미 있는 후원에 감사드리며 이 인증서를 드립니다.",
      amount: "후원 금액",
      presentedTo: "수여 대상",
      certificateNumber: "인증서 번호",
      issued: "발급일",
      pendingIssueDate: "발급일 미정",
      fallbackRecipient: "후원자",
      types: {
        donation: "후원 인증서",
        honor: "공로 인증서",
      },
      download: {
        title: "인증서 다운로드",
        svg: "SVG 다운로드",
        note: "SVG 파일은 브라우저에서 열거나 인쇄할 수 있습니다.",
      },
      navigation: {
        title: "인증서 탐색",
        home: "홈으로 돌아가기",
        dashboard: "대시보드로 돌아가기",
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

describe("certificate detail page", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.donationMaybeSingle.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.requireUser.mockReset();
    mocks.tierMaybeSingle.mockReset();
  });

  it("renders a localized protected certificate with amount and return navigation only", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      user_metadata: { name: "Ada Lovelace" },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(createCertificateClient());
    mocks.maybeSingle.mockResolvedValue({
      data: {
        certificate_number: "GBAI-2026-D-000001",
        donation_id: "donation-1",
        issued_at: "2026-04-30T00:00:00.000Z",
        type: "donation",
      },
      error: null,
    });
    mocks.donationMaybeSingle.mockResolvedValue({ data: { amount: 5000, currency: "usd", tier_id: "tier-yearly" }, error: null });
    mocks.tierMaybeSingle.mockResolvedValue({ data: { code: "yearly" }, error: null });

    render(await CertificatePage({ params: Promise.resolve({ id: "cert-1", locale: "ko" }) }));

    expect(screen.getByRole("heading", { name: "후원 인증서" })).toBeInTheDocument();
    expect(screen.getByLabelText("후원 인증서")).toHaveClass("overflow-hidden", "rounded-lg");
    expect(screen.getByLabelText("후원 인증서")).toHaveAttribute("data-certificate-template", "yearly");
    expect(screen.getByTestId("certificate-background")).toHaveStyle({
      backgroundImage: "url(/certificates/yearly-bg.webp)",
    });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("GBAI-2026-D-000001")).toBeInTheDocument();
    expect(screen.getByText("US$50.00")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SVG 다운로드" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "인증서 다운로드" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "대시보드로 돌아가기" })).toHaveAttribute("href", "/dashboard");
  });

  it("uses donation metadata tier for the certificate template while showing the actual paid amount", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      user_metadata: { name: "Ada Lovelace" },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(createCertificateClient());
    mocks.maybeSingle.mockResolvedValue({
      data: {
        certificate_number: "GBAI-2026-D-000002",
        donation_id: "donation-2",
        issued_at: "2026-04-30T00:00:00.000Z",
        type: "donation",
      },
      error: null,
    });
    mocks.donationMaybeSingle.mockResolvedValue({
      data: {
        amount: 1200,
        currency: "usd",
        metadata: { tier: "yearly" },
        tier_id: null,
      },
      error: null,
    });

    render(await CertificatePage({ params: Promise.resolve({ id: "cert-2", locale: "ko" }) }));

    expect(screen.getByLabelText("후원 인증서")).toHaveAttribute("data-certificate-template", "yearly");
    expect(screen.getByText("US$12.00")).toBeInTheDocument();
  });
});
