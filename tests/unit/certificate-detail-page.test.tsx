import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CertificatePage from "@/app/[locale]/dashboard/certificates/[id]/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  maybeSingle: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
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
      brand: "Three Friends",
      title: "후원 인증서",
      description: "독립 소프트웨어 개발을 위한 의미 있는 후원에 감사드리며 이 인증서를 드립니다.",
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
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: mocks.maybeSingle,
    select: vi.fn(() => query),
  };

  return {
    from: vi.fn(() => query),
  };
}

describe("certificate detail page", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.requireUser.mockReset();
  });

  it("renders a localized protected SVG download link", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      user_metadata: { name: "Ada Lovelace" },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(createCertificateClient());
    mocks.maybeSingle.mockResolvedValue({
      data: {
        certificate_number: "TF-DON-2026-0001",
        issued_at: "2026-04-30T00:00:00.000Z",
        type: "donation",
      },
      error: null,
    });

    render(await CertificatePage({ params: Promise.resolve({ id: "cert-1", locale: "ko" }) }));

    expect(screen.getByRole("heading", { name: "후원 인증서" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "인증서 다운로드" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SVG 다운로드" })).toHaveAttribute(
      "href",
      "/ko/dashboard/certificates/cert-1/download/svg",
    );
    expect(screen.getByText("SVG 파일은 브라우저에서 열거나 인쇄할 수 있습니다.")).toBeInTheDocument();
  });
});
