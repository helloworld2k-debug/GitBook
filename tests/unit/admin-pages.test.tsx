import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminPage from "@/app/[locale]/admin/page";
import AdminCertificatesPage from "@/app/[locale]/admin/certificates/page";
import AdminDonationsPage from "@/app/[locale]/admin/donations/page";

const requireAdminMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const intlState = vi.hoisted(() => ({ locale: "en" }));

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

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn((namespace: "admin") => {
    const messages = testMessages[intlState.locale as keyof typeof testMessages][namespace];

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
  setRequestLocale: vi.fn((locale: string) => {
    intlState.locale = locale;
  }),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

function createOrderedQuery(data: unknown, error: Error | null = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ order }));

  return { order, select };
}

const testMessages = {
  en: {
    admin: {
      overview: {
        eyebrow: "Admin tools",
        title: "Admin",
        donationsTitle: "Donations",
        donationsDescription: "Review payment provider records, statuses, and transaction IDs.",
        certificatesTitle: "Certificates",
        certificatesDescription: "Review issued certificate numbers, types, statuses, and issue dates.",
      },
      donations: {
        eyebrow: "Admin",
        title: "Admin donations",
        provider: "Provider",
        status: "Status",
        amount: "Amount",
        transactionId: "Transaction ID",
        empty: "No donations found.",
        statuses: {
          pending: "Pending",
          paid: "Paid",
          cancelled: "Cancelled",
          failed: "Failed",
          refunded: "Refunded",
        },
      },
      certificates: {
        eyebrow: "Admin",
        title: "Admin certificates",
        certificateNumber: "Certificate number",
        type: "Type",
        status: "Status",
        issued: "Issued",
        notIssued: "Not issued",
        empty: "No certificates found.",
        types: {
          donation: "Donation Certificate",
          honor: "Honor Certificate",
        },
        statuses: {
          active: "Active",
          revoked: "Revoked",
          generation_failed: "Generation failed",
        },
      },
    },
  },
  "zh-Hant": {
    admin: {
      overview: {
        eyebrow: "管理工具",
        title: "管理後台",
        donationsTitle: "捐贈",
        donationsDescription: "檢視付款服務商記錄、狀態與交易 ID。",
        certificatesTitle: "證書",
        certificatesDescription: "檢視已頒發的證書編號、類型、狀態與頒發日期。",
      },
      donations: {
        eyebrow: "管理後台",
        title: "管理捐贈",
        provider: "服務商",
        status: "狀態",
        amount: "金額",
        transactionId: "交易 ID",
        empty: "尚無捐贈。",
        statuses: {
          pending: "待處理",
          paid: "已付款",
          cancelled: "已取消",
          failed: "失敗",
          refunded: "已退款",
        },
      },
      certificates: {
        eyebrow: "管理後台",
        title: "管理證書",
        certificateNumber: "證書編號",
        type: "類型",
        status: "狀態",
        issued: "頒發日期",
        notIssued: "尚未頒發",
        empty: "尚無證書。",
        types: {
          donation: "捐贈證書",
          honor: "榮譽證書",
        },
        statuses: {
          active: "有效",
          revoked: "已撤銷",
          generation_failed: "產生失敗",
        },
      },
    },
  },
  ko: {
    admin: {
      overview: {
        eyebrow: "관리 도구",
        title: "관리",
        donationsTitle: "후원",
        donationsDescription: "결제 제공업체 기록, 상태, 거래 ID를 확인합니다.",
        certificatesTitle: "인증서",
        certificatesDescription: "발급된 인증서 번호, 유형, 상태, 발급일을 확인합니다.",
      },
      donations: {
        eyebrow: "관리",
        title: "관리자 후원",
        provider: "제공업체",
        status: "상태",
        amount: "금액",
        transactionId: "거래 ID",
        empty: "후원 기록이 없습니다.",
        statuses: {
          pending: "대기 중",
          paid: "결제 완료",
          cancelled: "취소됨",
          failed: "실패",
          refunded: "환불됨",
        },
      },
      certificates: {
        eyebrow: "관리",
        title: "관리자 인증서",
        certificateNumber: "인증서 번호",
        type: "유형",
        status: "상태",
        issued: "발급일",
        notIssued: "미발급",
        empty: "인증서가 없습니다.",
        types: {
          donation: "후원 인증서",
          honor: "공로 인증서",
        },
        statuses: {
          active: "활성",
          revoked: "폐기됨",
          generation_failed: "생성 실패",
        },
      },
    },
  },
};

describe("admin pages", () => {
  beforeEach(() => {
    intlState.locale = "en";
    requireAdminMock.mockReset().mockResolvedValue({ id: "admin-1" });
    createSupabaseServerClientMock.mockReset();
  });

  it("renders the guarded admin overview without links to routes that do not exist yet", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en");
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /donations/i })).toHaveAttribute("href", "/admin/donations");
    expect(screen.getByRole("link", { name: /certificates/i })).toHaveAttribute("href", "/admin/certificates");
    expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("renders localized admin overview copy beyond English", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "zh-Hant" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh-Hant");
    expect(screen.getByText("管理工具")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "管理後台" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /捐贈/ })).toHaveAttribute("href", "/admin/donations");
    expect(screen.getByText("檢視付款服務商記錄、狀態與交易 ID。")).toBeInTheDocument();
  });

  it("queries and renders donations for admins", async () => {
    const donationsQuery = createOrderedQuery([
      {
        id: "donation-1",
        provider: "stripe",
        status: "paid",
        amount: 5000,
        currency: "usd",
        provider_transaction_id: "txn_123",
      },
    ]);
    const from = vi.fn(() => donationsQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminDonationsPage({ params: Promise.resolve({ locale: "zh-Hant" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh-Hant");
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("donations");
    expect(donationsQuery.select).toHaveBeenCalledWith("id,provider,status,amount,currency,provider_transaction_id");
    expect(donationsQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "管理捐贈" })).toBeInTheDocument();
    expect(screen.getByText("stripe")).toBeInTheDocument();
    expect(screen.getByText("已付款")).toBeInTheDocument();
    expect(screen.queryByText("paid")).not.toBeInTheDocument();
    expect(screen.getByText("US$50.00 USD")).toBeInTheDocument();
    expect(screen.getByText("txn_123")).toBeInTheDocument();
  });

  it("throws Supabase donation query errors", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => createOrderedQuery(null, new Error("donations failed"))),
    });

    await expect(AdminDonationsPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "donations failed",
    );
  });

  it("queries and renders certificates for admins", async () => {
    const certificatesQuery = createOrderedQuery([
      {
        id: "certificate-1",
        certificate_number: "DON-2026-000001",
        type: "donation",
        status: "active",
        issued_at: "2026-04-29T12:00:00.000Z",
      },
    ]);
    const from = vi.fn(() => certificatesQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminCertificatesPage({ params: Promise.resolve({ locale: "ko" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("ko");
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("certificates");
    expect(certificatesQuery.select).toHaveBeenCalledWith("id,certificate_number,type,status,issued_at");
    expect(certificatesQuery.order).toHaveBeenCalledWith("issued_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "관리자 인증서" })).toBeInTheDocument();
    expect(screen.getByText("인증서 번호")).toBeInTheDocument();
    expect(screen.getByText("DON-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("후원 인증서")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.queryByText("donation")).not.toBeInTheDocument();
    expect(screen.queryByText("active")).not.toBeInTheDocument();
    expect(screen.getByText("2026년 4월 29일")).toBeInTheDocument();
  });

  it("throws Supabase certificate query errors", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => createOrderedQuery(null, new Error("certificates failed"))),
    });

    await expect(AdminCertificatesPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "certificates failed",
    );
  });
});
