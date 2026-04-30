import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminPage from "@/app/[locale]/admin/page";
import AdminAuditLogsPage from "@/app/[locale]/admin/audit-logs/page";
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
        auditLogsTitle: "Audit logs",
        auditLogsDescription: "Review admin corrections, revocations, and reasons.",
      },
      donations: {
        eyebrow: "Admin",
        title: "Admin donations",
        provider: "Provider",
        status: "Status",
        amount: "Amount",
        transactionId: "Transaction ID",
        manualEntryTitle: "Manual paid donation",
        manualEntryDescription: "Create one paid manual record for an existing user by email or user ID.",
        userIdentifier: "Email or user ID",
        amountCents: "Amount (cents)",
        reason: "Reason",
        submitManualDonation: "Add manual donation",
        empty: "No donations found.",
        providers: {
          stripe: "Stripe",
          paypal: "PayPal",
          manual: "Manual",
        },
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
        action: "Action",
        revokeReason: "Reason",
        revoke: "Revoke",
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
      auditLogs: {
        eyebrow: "Admin",
        title: "Audit logs",
        action: "Action",
        target: "Target",
        reason: "Reason",
        createdAt: "Created",
        admin: "Admin",
        empty: "No audit logs found.",
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
        auditLogsTitle: "稽核紀錄",
        auditLogsDescription: "檢視管理員修正、撤銷與原因。",
      },
      donations: {
        eyebrow: "管理後台",
        title: "管理捐贈",
        provider: "服務商",
        status: "狀態",
        amount: "金額",
        transactionId: "交易 ID",
        manualEntryTitle: "人工已付款捐贈",
        manualEntryDescription: "為既有使用者以電子郵件或使用者 ID 建立一筆已付款人工記錄。",
        userIdentifier: "電子郵件或使用者 ID",
        amountCents: "金額（美分）",
        reason: "原因",
        submitManualDonation: "新增人工捐贈",
        empty: "尚無捐贈。",
        providers: {
          stripe: "Stripe",
          paypal: "PayPal",
          manual: "人工登錄",
        },
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
        action: "操作",
        revokeReason: "原因",
        revoke: "撤銷",
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
      auditLogs: {
        eyebrow: "管理後台",
        title: "稽核紀錄",
        action: "操作",
        target: "目標",
        reason: "原因",
        createdAt: "建立時間",
        admin: "管理員",
        empty: "尚無稽核紀錄。",
      },
    },
  },
  ja: {
    admin: {
      overview: {
        eyebrow: "管理ツール",
        title: "管理画面",
        donationsTitle: "寄付",
        donationsDescription: "決済プロバイダーの記録、ステータス、取引 ID を確認します。",
        certificatesTitle: "証明書",
        certificatesDescription: "発行済み証明書の番号、種類、ステータス、発行日を確認します。",
        auditLogsTitle: "監査ログ",
        auditLogsDescription: "管理者の修正、取り消し、理由を確認します。",
      },
      donations: {
        eyebrow: "管理画面",
        title: "管理者向け寄付",
        provider: "プロバイダー",
        status: "ステータス",
        amount: "金額",
        transactionId: "取引 ID",
        manualEntryTitle: "手動支払い済み寄付",
        manualEntryDescription: "既存ユーザーのメールまたはユーザー ID で支払い済み手動記録を 1 件作成します。",
        userIdentifier: "メールまたはユーザー ID",
        amountCents: "金額（セント）",
        reason: "理由",
        submitManualDonation: "手動寄付を追加",
        empty: "寄付はまだありません。",
        providers: {
          stripe: "Stripe",
          paypal: "PayPal",
          manual: "手動",
        },
        statuses: {
          pending: "保留中",
          paid: "支払い済み",
          cancelled: "キャンセル済み",
          failed: "失敗",
          refunded: "返金済み",
        },
      },
      certificates: {
        eyebrow: "管理画面",
        title: "管理者向け証明書",
        certificateNumber: "証明書番号",
        type: "種類",
        status: "ステータス",
        issued: "発行日",
        action: "操作",
        revokeReason: "理由",
        revoke: "取り消す",
        notIssued: "未発行",
        empty: "証明書はまだありません。",
        types: {
          donation: "寄付証明書",
          honor: "表彰証明書",
        },
        statuses: {
          active: "有効",
          revoked: "取り消し済み",
          generation_failed: "生成失敗",
        },
      },
      auditLogs: {
        eyebrow: "管理画面",
        title: "監査ログ",
        action: "操作",
        target: "対象",
        reason: "理由",
        createdAt: "作成日時",
        admin: "管理者",
        empty: "監査ログはまだありません。",
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
        auditLogsTitle: "감사 로그",
        auditLogsDescription: "관리자 수정, 폐기, 사유를 확인합니다.",
      },
      donations: {
        eyebrow: "관리",
        title: "관리자 후원",
        provider: "제공업체",
        status: "상태",
        amount: "금액",
        transactionId: "거래 ID",
        manualEntryTitle: "수동 결제 완료 후원",
        manualEntryDescription: "기존 사용자의 이메일 또는 사용자 ID로 결제 완료 수동 기록을 하나 만듭니다.",
        userIdentifier: "이메일 또는 사용자 ID",
        amountCents: "금액(센트)",
        reason: "사유",
        submitManualDonation: "수동 후원 추가",
        empty: "후원 기록이 없습니다.",
        providers: {
          stripe: "Stripe",
          paypal: "PayPal",
          manual: "수동",
        },
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
        action: "작업",
        revokeReason: "사유",
        revoke: "폐기",
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
      auditLogs: {
        eyebrow: "관리",
        title: "감사 로그",
        action: "작업",
        target: "대상",
        reason: "사유",
        createdAt: "생성일",
        admin: "관리자",
        empty: "감사 로그가 없습니다.",
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

  it("renders the guarded admin overview with admin tool links", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en");
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /donations/i })).toHaveAttribute("href", "/admin/donations");
    expect(screen.getByRole("link", { name: /certificates/i })).toHaveAttribute("href", "/admin/certificates");
    expect(screen.getByRole("link", { name: /audit logs/i })).toHaveAttribute("href", "/admin/audit-logs");
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("renders localized admin overview copy beyond English", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "zh-Hant" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh-Hant");
    expect(screen.getByText("管理工具")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "管理後台" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /捐贈/ })).toHaveAttribute("href", "/admin/donations");
    expect(screen.getByRole("link", { name: /稽核紀錄/ })).toHaveAttribute("href", "/admin/audit-logs");
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
      {
        id: "donation-2",
        provider: "manual",
        status: "refunded",
        amount: 1200,
        currency: "usd",
        provider_transaction_id: "manual_456",
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
    expect(screen.getByRole("heading", { name: "人工已付款捐贈" })).toBeInTheDocument();
    expect(screen.getByLabelText("電子郵件或使用者 ID")).toBeRequired();
    expect(screen.getByLabelText("原因")).toBeRequired();
    expect(screen.getByRole("button", { name: "新增人工捐贈" })).toBeInTheDocument();
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText("人工登錄")).toBeInTheDocument();
    expect(screen.queryByText("stripe")).not.toBeInTheDocument();
    expect(screen.queryByText("manual")).not.toBeInTheDocument();
    expect(screen.getByText("已付款")).toBeInTheDocument();
    expect(screen.getByText("已退款")).toBeInTheDocument();
    expect(screen.queryByText("paid")).not.toBeInTheDocument();
    expect(screen.getByText("US$50.00 USD")).toBeInTheDocument();
    expect(screen.getByText("txn_123")).toBeInTheDocument();
    expect(screen.getByText("manual_456")).toBeInTheDocument();
  });

  it("renders Japanese admin donation enum labels", async () => {
    const donationsQuery = createOrderedQuery([
      {
        id: "donation-1",
        provider: "paypal",
        status: "cancelled",
        amount: 3500,
        currency: "usd",
        provider_transaction_id: "paypal_txn_789",
      },
    ]);
    const from = vi.fn(() => donationsQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminDonationsPage({ params: Promise.resolve({ locale: "ja" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("ja");
    expect(screen.getByRole("heading", { name: "管理者向け寄付" })).toBeInTheDocument();
    expect(screen.getByText("PayPal")).toBeInTheDocument();
    expect(screen.getByText("キャンセル済み")).toBeInTheDocument();
    expect(screen.queryByText("paypal")).not.toBeInTheDocument();
    expect(screen.queryByText("cancelled")).not.toBeInTheDocument();
    expect(screen.getByText("$35.00 USD")).toBeInTheDocument();
    expect(screen.getByText("paypal_txn_789")).toBeInTheDocument();
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
    expect(screen.getByLabelText("사유")).toBeRequired();
    expect(screen.getByRole("button", { name: "폐기" })).toBeInTheDocument();
  });

  it("renders Japanese admin certificate enum labels", async () => {
    const certificatesQuery = createOrderedQuery([
      {
        id: "certificate-1",
        certificate_number: "HON-2026-000002",
        type: "honor",
        status: "revoked",
        issued_at: "2026-04-30T00:00:00.000Z",
      },
    ]);
    const from = vi.fn(() => certificatesQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminCertificatesPage({ params: Promise.resolve({ locale: "ja" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("ja");
    expect(screen.getByRole("heading", { name: "管理者向け証明書" })).toBeInTheDocument();
    expect(screen.getByText("HON-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("表彰証明書")).toBeInTheDocument();
    expect(screen.getByText("取り消し済み")).toBeInTheDocument();
    expect(screen.queryByText("honor")).not.toBeInTheDocument();
    expect(screen.queryByText("revoked")).not.toBeInTheDocument();
    expect(screen.getByText("2026年4月30日")).toBeInTheDocument();
  });

  it("throws Supabase certificate query errors", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => createOrderedQuery(null, new Error("certificates failed"))),
    });

    await expect(AdminCertificatesPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "certificates failed",
    );
  });

  it("queries and renders newest audit logs for admins", async () => {
    const auditLogsQuery = createOrderedQuery([
      {
        id: "log-1",
        admin_user_id: "admin-1",
        action: "revoke_certificate",
        target_type: "certificate",
        target_id: "certificate-1",
        reason: "Refund confirmed",
        created_at: "2026-04-30T10:00:00.000Z",
        profiles: { email: "admin@example.com" },
      },
    ]);
    const from = vi.fn(() => auditLogsQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminAuditLogsPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en");
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("admin_audit_logs");
    expect(auditLogsQuery.select).toHaveBeenCalledWith(
      "id,admin_user_id,action,target_type,target_id,reason,created_at,profiles(email)",
    );
    expect(auditLogsQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "Audit logs" })).toBeInTheDocument();
    expect(screen.getByText("revoke_certificate")).toBeInTheDocument();
    expect(screen.getByText("certificate/certificate-1")).toBeInTheDocument();
    expect(screen.getByText("Refund confirmed")).toBeInTheDocument();
    expect(screen.getByText("admin-1")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Apr 30, 2026/)).toBeInTheDocument();
  });
});
