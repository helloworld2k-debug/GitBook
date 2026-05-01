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

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({ currentLocale }: { currentLocale: string }) => <div>Language {currentLocale}</div>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(() => intlState.locale),
  getTranslations: vi.fn((namespace: "admin") => {
    const value = namespace.split(".").reduce<unknown>((current, segment) => {
      if (current && typeof current === "object" && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, testMessages[intlState.locale as keyof typeof testMessages]);
    const messages = value as Record<string, unknown>;

    return (key: string, values?: Record<string, string>) => {
      const value = key.split(".").reduce<unknown>((current, segment) => {
        if (current && typeof current === "object" && segment in current) {
          return (current as Record<string, unknown>)[segment];
        }

        return undefined;
      }, messages);

      if (typeof value !== "string") {
        throw new Error(`Missing test message: ${namespace}.${key}`);
      }

      return Object.entries(values ?? {}).reduce(
        (message, [name, replacement]) => message.replaceAll(`{${name}}`, replacement),
        value,
      );
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
        description: "Manage donations, certificates, releases, licenses, users, and audit activity.",
        donationsTitle: "Donations",
        donationsDescription: "Review payment provider records, statuses, and transaction IDs.",
        certificatesTitle: "Certificates",
        certificatesDescription: "Review issued certificate numbers, types, statuses, and issue dates.",
        releasesTitle: "Releases",
        releasesDescription: "Upload installers and manage releases.",
        licensesTitle: "Licenses",
        licensesDescription: "Create trial codes, review entitlements, and revoke desktop cloud sync access.",
        usersTitle: "Users",
        usersDescription: "Review account roles, statuses, trial bindings, and desktop devices.",
        auditLogsTitle: "Audit logs",
        auditLogsDescription: "Review admin corrections, revocations, and reasons.",
      },
      donations: {
        eyebrow: "Admin",
        title: "Admin donations",
        description: "Review payment records and add verified manual donations.",
        provider: "Provider",
        status: "Status",
        amount: "Amount",
        transactionId: "Transaction ID",
        manualEntryTitle: "Manual paid donation",
        manualEntryDescription: "Create one paid manual record for an existing user by email or user ID.",
        userIdentifier: "Email or user ID",
        amountCents: "Amount (cents)",
        reference: "Reference",
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
        description: "Review issued certificates and revoke records when needed.",
        certificateNumber: "Certificate number",
        type: "Type",
        status: "Status",
        issued: "Issued",
        action: "Action",
        revokeReason: "Reason",
        revoke: "Revoke",
        revokeAriaLabel: "Revoke certificate {certificateNumber}",
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
        description: "Review administrative changes and support actions.",
        action: "Action",
        target: "Target",
        reason: "Reason",
        createdAt: "Created",
        admin: "Admin",
        empty: "No audit logs found.",
      },
      shell: {
        auditLogs: "Audit Logs",
        backToAdmin: "Back to admin",
        certificates: "Certificates",
        dashboard: "Overview",
        donations: "Donations",
        language: "Language",
        licenses: "Licenses",
        menu: "Menu",
        releases: "Releases",
        returnToSite: "Return to site",
        users: "Users",
      },
    },
  },
  "zh-Hant": {
    admin: {
      overview: {
        eyebrow: "管理工具",
        title: "管理後台",
        description: "管理捐贈、證書、版本、授權、使用者與稽核活動。",
        donationsTitle: "捐贈",
        donationsDescription: "檢視付款服務商記錄、狀態與交易 ID。",
        certificatesTitle: "證書",
        certificatesDescription: "檢視已頒發的證書編號、類型、狀態與頒發日期。",
        releasesTitle: "版本發布",
        releasesDescription: "上傳安裝包並管理版本。",
        licensesTitle: "授權",
        licensesDescription: "建立試用兌換碼、檢視權益，並撤銷桌面雲端同步存取。",
        usersTitle: "使用者",
        usersDescription: "檢視帳號角色、狀態、試用綁定與桌面裝置。",
        auditLogsTitle: "稽核紀錄",
        auditLogsDescription: "檢視管理員修正、撤銷與原因。",
      },
      donations: {
        eyebrow: "管理後台",
        title: "管理捐贈",
        description: "檢視付款記錄，並新增已驗證的人工捐贈。",
        provider: "服務商",
        status: "狀態",
        amount: "金額",
        transactionId: "交易 ID",
        manualEntryTitle: "人工已付款捐贈",
        manualEntryDescription: "為既有使用者以電子郵件或使用者 ID 建立一筆已付款人工記錄。",
        userIdentifier: "電子郵件或使用者 ID",
        amountCents: "金額（美分）",
        reference: "參考編號",
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
        description: "檢視已頒發證書，必要時撤銷記錄。",
        certificateNumber: "證書編號",
        type: "類型",
        status: "狀態",
        issued: "頒發日期",
        action: "操作",
        revokeReason: "原因",
        revoke: "撤銷",
        revokeAriaLabel: "撤銷證書 {certificateNumber}",
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
        description: "檢視管理變更與支援操作。",
        action: "操作",
        target: "目標",
        reason: "原因",
        createdAt: "建立時間",
        admin: "管理員",
        empty: "尚無稽核紀錄。",
      },
      shell: {
        auditLogs: "稽核紀錄",
        backToAdmin: "返回管理首頁",
        certificates: "證書",
        dashboard: "總覽",
        donations: "捐贈",
        language: "語言",
        licenses: "授權",
        menu: "選單",
        releases: "版本發布",
        returnToSite: "返回網站",
        users: "使用者",
      },
    },
  },
  ja: {
    admin: {
      overview: {
        eyebrow: "管理ツール",
        title: "管理画面",
        description: "寄付、証明書、リリース、ライセンス、ユーザー、監査履歴を管理します。",
        donationsTitle: "寄付",
        donationsDescription: "決済プロバイダーの記録、ステータス、取引 ID を確認します。",
        certificatesTitle: "証明書",
        certificatesDescription: "発行済み証明書の番号、種類、ステータス、発行日を確認します。",
        releasesTitle: "リリース",
        releasesDescription: "インストーラーとリリースを管理します。",
        licensesTitle: "ライセンス",
        licensesDescription: "試用コード、権限、デスクトップのクラウド同期アクセスを管理します。",
        usersTitle: "ユーザー",
        usersDescription: "アカウント権限、状態、トライアル紐付け、デスクトップ端末を確認します。",
        auditLogsTitle: "監査ログ",
        auditLogsDescription: "管理者の修正、取り消し、理由を確認します。",
      },
      donations: {
        eyebrow: "管理画面",
        title: "管理者向け寄付",
        description: "決済記録を確認し、検証済みの手動寄付を追加します。",
        provider: "プロバイダー",
        status: "ステータス",
        amount: "金額",
        transactionId: "取引 ID",
        manualEntryTitle: "手動支払い済み寄付",
        manualEntryDescription: "既存ユーザーのメールまたはユーザー ID で支払い済み手動記録を 1 件作成します。",
        userIdentifier: "メールまたはユーザー ID",
        amountCents: "金額（セント）",
        reference: "参照番号",
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
        description: "発行済み証明書を確認し、必要に応じて取り消します。",
        certificateNumber: "証明書番号",
        type: "種類",
        status: "ステータス",
        issued: "発行日",
        action: "操作",
        revokeReason: "理由",
        revoke: "取り消す",
        revokeAriaLabel: "証明書 {certificateNumber} を取り消す",
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
        description: "管理変更とサポート操作を確認します。",
        action: "操作",
        target: "対象",
        reason: "理由",
        createdAt: "作成日時",
        admin: "管理者",
        empty: "監査ログはまだありません。",
      },
      shell: {
        auditLogs: "監査ログ",
        backToAdmin: "管理画面へ戻る",
        certificates: "証明書",
        dashboard: "概要",
        donations: "寄付",
        language: "言語",
        licenses: "ライセンス",
        menu: "メニュー",
        releases: "リリース",
        returnToSite: "サイトへ戻る",
        users: "ユーザー",
      },
    },
  },
  ko: {
    admin: {
      overview: {
        eyebrow: "관리 도구",
        title: "관리",
        description: "후원, 인증서, 릴리스, 라이선스, 사용자, 감사 활동을 관리합니다.",
        donationsTitle: "후원",
        donationsDescription: "결제 제공업체 기록, 상태, 거래 ID를 확인합니다.",
        certificatesTitle: "인증서",
        certificatesDescription: "발급된 인증서 번호, 유형, 상태, 발급일을 확인합니다.",
        releasesTitle: "릴리스",
        releasesDescription: "설치 파일과 릴리스를 관리합니다.",
        licensesTitle: "라이선스",
        licensesDescription: "체험 코드, 권한, 데스크톱 클라우드 동기화 접속을 관리합니다.",
        usersTitle: "사용자",
        usersDescription: "계정 역할, 상태, 체험 연결, 데스크톱 기기를 확인합니다.",
        auditLogsTitle: "감사 로그",
        auditLogsDescription: "관리자 수정, 폐기, 사유를 확인합니다.",
      },
      donations: {
        eyebrow: "관리",
        title: "관리자 후원",
        description: "결제 기록을 확인하고 검증된 수동 후원을 추가합니다.",
        provider: "제공업체",
        status: "상태",
        amount: "금액",
        transactionId: "거래 ID",
        manualEntryTitle: "수동 결제 완료 후원",
        manualEntryDescription: "기존 사용자의 이메일 또는 사용자 ID로 결제 완료 수동 기록을 하나 만듭니다.",
        userIdentifier: "이메일 또는 사용자 ID",
        amountCents: "금액(센트)",
        reference: "참조 번호",
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
        description: "발급된 인증서를 확인하고 필요한 경우 폐기합니다.",
        certificateNumber: "인증서 번호",
        type: "유형",
        status: "상태",
        issued: "발급일",
        action: "작업",
        revokeReason: "사유",
        revoke: "폐기",
        revokeAriaLabel: "인증서 {certificateNumber} 폐기",
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
        description: "관리 변경과 지원 작업을 확인합니다.",
        action: "작업",
        target: "대상",
        reason: "사유",
        createdAt: "생성일",
        admin: "관리자",
        empty: "감사 로그가 없습니다.",
      },
      shell: {
        auditLogs: "감사 로그",
        backToAdmin: "관리 홈으로 돌아가기",
        certificates: "인증서",
        dashboard: "개요",
        donations: "후원",
        language: "언어",
        licenses: "라이선스",
        menu: "메뉴",
        releases: "릴리스",
        returnToSite: "사이트로 돌아가기",
        users: "사용자",
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
    expect(screen.getAllByRole("link", { name: /donations/i }).some((link) => link.getAttribute("href") === "/admin/donations")).toBe(true);
    expect(screen.getAllByRole("link", { name: /certificates/i }).some((link) => link.getAttribute("href") === "/admin/certificates")).toBe(true);
    expect(screen.getAllByRole("link", { name: /releases/i }).some((link) => link.getAttribute("href") === "/admin/releases")).toBe(true);
    expect(screen.getAllByRole("link", { name: /audit logs/i }).some((link) => link.getAttribute("href") === "/admin/audit-logs")).toBe(true);
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
  });

  it("renders localized admin overview copy beyond English", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "zh-Hant" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh-Hant");
    expect(screen.getByText("管理工具")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "管理後台" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /捐贈/ }).some((link) => link.getAttribute("href") === "/admin/donations")).toBe(true);
    expect(screen.getAllByRole("link", { name: /版本發布/ }).some((link) => link.getAttribute("href") === "/admin/releases")).toBe(true);
    expect(screen.getAllByRole("link", { name: /稽核紀錄/ }).some((link) => link.getAttribute("href") === "/admin/audit-logs")).toBe(true);
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
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
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
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
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
    expect(screen.getByRole("button", { name: "인증서 DON-2026-000001 폐기" })).toBeInTheDocument();
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
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
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
