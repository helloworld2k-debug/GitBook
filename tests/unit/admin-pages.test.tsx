import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminPage from "@/app/[locale]/admin/page";
import AdminAuditLogsPage from "@/app/[locale]/admin/audit-logs/page";
import AdminCertificatesPage from "@/app/[locale]/admin/certificates/page";
import AdminDonationsPage from "@/app/[locale]/admin/donations/page";
import AdminLicensesPage from "@/app/[locale]/admin/licenses/page";
import AdminUserDetailPage from "@/app/[locale]/admin/users/[id]/page";
import AdminUsersPage from "@/app/[locale]/admin/users/page";

const requireAdminMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
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
  isOwnerProfile: (profile: { account_status?: string | null; admin_role?: string | null; is_admin?: boolean } | null) =>
    profile?.account_status !== "disabled" && (profile?.is_admin === true || profile?.admin_role === "owner"),
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

function createOrderedQuery(data: unknown, error: Error | null = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ order }));

  return { order, select };
}

function createAdminListQuery(data: unknown, error: Error | null = null) {
  const query = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data, error })),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data, error })),
  };

  return query;
}

const testMessages = {
  en: {
    admin: {
      common: {
        processing: "Processing...",
        saving: "Saving...",
      },
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
        notificationsTitle: "Notifications",
        notificationsDescription: "Publish and unpublish in-app announcements.",
        supportFeedbackTitle: "Feedback",
        supportFeedbackDescription: "Review account issue reports and support requests.",
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
        paidAt: "Paid at (UTC)",
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
      licenses: {
        eyebrow: "Admin",
        title: "License management",
        description: "Manage short cloud sync trial codes, trial bindings, entitlements, desktop sessions, and cloud sync leases.",
        createTrialTitle: "Create trial code",
        createTrialDescription: "Create one auto-generated website trial code. Trials default to 3 days and can be set up to 7 days.",
        trialDays: "Trial days",
        label: "Label",
        createTrial: "Create trial code",
        trialCodesTitle: "Trial codes",
        code: "Code",
        duration: "Duration",
        generatedAt: "Generated",
        redemptions: "Redemptions",
        status: "Status",
        action: "Action",
        deletedAt: "Deleted",
        deletedBy: "Deleted by",
        days: "days",
        active: "Active",
        inactive: "Inactive",
        activate: "Activate",
        deactivate: "Deactivate",
        save: "Save",
        delete: "Delete",
        reveal: "Reveal",
        hide: "Hide",
        revealHelp: "Reveal only when sending this code to a user. The view is audited.",
        revealError: "Unable to reveal this code.",
        deletedTrialCodesTitle: "Deleted trial codes",
        emptyDeletedTrialCodes: "No deleted trial codes found.",
        emptyTrialCodes: "No trial codes found.",
        trialRedemptionsTitle: "Trial redemptions",
        user: "User",
        redeemedAt: "Redeemed",
        validUntil: "Valid until",
        device: "Device",
        machine: "Machine",
        bound: "Bound",
        unbound: "Unbound",
        emptyTrialRedemptions: "No trial redemptions found.",
        entitlementsTitle: "Entitlements",
        feature: "Feature",
        sourceDonation: "Source donation",
        none: "None",
        emptyEntitlements: "No entitlements found.",
        desktopSessionsTitle: "Desktop sessions",
        platform: "Platform",
        lastSeen: "Last seen",
        expiresAt: "Expires",
        revokedAt: "Revoked",
        notRevoked: "Not revoked",
        revoke: "Revoke",
        emptySessions: "No desktop sessions found.",
        cloudSyncLeasesTitle: "Cloud sync leases",
        session: "Session",
        lastHeartbeat: "Last heartbeat",
        emptyLeases: "No cloud sync leases found.",
        durations: {
          trial_3_day: "Trial",
          month_1: "Legacy 1 month",
          month_3: "Legacy 3 months",
          year_1: "Legacy 1 year",
        },
      },
      users: {
        eyebrow: "Admin",
        title: "User management",
        detailTitle: "User operations",
        detailDescription: "Review and maintain one user's profile, donations, certificates, trials, devices, and entitlements.",
        user: "User",
        details: "Details",
        role: "Role",
        status: "Status",
        trials: "Trials",
        devices: "Devices",
        donations: "Donations",
        certificates: "Certificates",
        entitlements: "Entitlements",
        leases: "Leases",
        sessions: "Desktop sessions",
        save: "Save",
        saveRole: "Save role",
        viewDetails: "View details",
        displayName: "Display name",
        publicDisplayName: "Public display name",
        publicSupporter: "Public supporter",
        bound: "Bound",
        unbound: "Awaiting first desktop login",
        redeemed: "Redeemed",
        validUntil: "Valid until",
        machine: "Machine",
        lastSeen: "Last seen",
        unbind: "Unbind machine",
        addDonation: "Add manual donation",
        emptyTrials: "No trials",
        emptyDevices: "No desktop devices",
        emptyDonations: "No donations",
        emptyCertificates: "No certificates",
        emptyEntitlements: "No entitlements",
        emptyLeases: "No leases",
        roles: {
          owner: "Owner",
          operator: "Operator",
          user: "User",
        },
        statuses: {
          active: "Active",
          disabled: "Disabled",
        },
        description: "Review account roles, statuses, trial bindings, and desktop devices.",
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
        notifications: "Notifications",
        releases: "Releases",
        returnToSite: "Return to site",
        supportFeedback: "Feedback",
        users: "Users",
      },
    },
  },
  "zh-Hant": {
    admin: {
      common: {
        processing: "處理中...",
        saving: "儲存中...",
      },
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
        notificationsTitle: "通知",
        notificationsDescription: "發布與下架站內通知。",
        supportFeedbackTitle: "回饋",
        supportFeedbackDescription: "檢視帳號問題與支援請求。",
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
        paidAt: "付款時間（UTC）",
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
        notifications: "通知",
        releases: "版本發布",
        returnToSite: "返回網站",
        supportFeedback: "回饋",
        users: "使用者",
      },
    },
  },
  ja: {
    admin: {
      common: {
        processing: "Processing...",
        saving: "Saving...",
      },
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
        notificationsTitle: "通知",
        notificationsDescription: "アプリ内通知を公開・非公開にします。",
        supportFeedbackTitle: "フィードバック",
        supportFeedbackDescription: "アカウント問題とサポート依頼を確認します。",
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
        paidAt: "支払い日時（UTC）",
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
        notifications: "通知",
        releases: "リリース",
        returnToSite: "サイトへ戻る",
        supportFeedback: "フィードバック",
        users: "ユーザー",
      },
    },
  },
  ko: {
    admin: {
      common: {
        processing: "Processing...",
        saving: "Saving...",
      },
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
        notificationsTitle: "알림",
        notificationsDescription: "앱 내 공지를 게시하거나 내립니다.",
        supportFeedbackTitle: "피드백",
        supportFeedbackDescription: "계정 문제와 지원 요청을 확인합니다.",
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
        paidAt: "결제 시간(UTC)",
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
        notifications: "알림",
        releases: "릴리스",
        returnToSite: "사이트로 돌아가기",
        supportFeedback: "피드백",
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
    createSupabaseAdminClientMock.mockReset();
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
    expect(donationsQuery.select).toHaveBeenCalledWith("id,provider,status,amount,currency,provider_transaction_id,paid_at,created_at");
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

  it("renders trial-only license management without paid code batch actions", async () => {
    const trialCodesQuery = createAdminListQuery([
      {
        id: "trial-code-1",
        label: "Launch trial",
        trial_days: 3,
        duration_kind: "trial_3_day",
        code_mask: "ABCD-****-****-MNOP",
        batch_id: null,
        max_redemptions: 1,
        redemption_count: 0,
        is_active: true,
        updated_by: null,
        created_at: "2026-05-01T10:00:00.000Z",
        deleted_at: null,
      },
    ]);
    const deletedTrialCodesQuery = createAdminListQuery([
      {
        id: "trial-code-deleted",
        label: "Old trial",
        trial_days: 3,
        code_mask: "WXYZ-****-****-ABCD",
        redemption_count: 0,
        max_redemptions: 1,
        is_active: false,
        created_at: "2026-04-01T10:00:00.000Z",
        deleted_at: "2026-05-02T10:00:00.000Z",
        updated_by: "admin-1",
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const from = vi.fn((table: string) => {
      if (table === "trial_codes") {
        return from.mock.calls.filter(([name]) => name === "trial_codes").length === 1
          ? trialCodesQuery
          : deletedTrialCodesQuery;
      }
      return emptyQuery;
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminLicensesPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(from).toHaveBeenCalledWith("trial_codes");
    expect(trialCodesQuery.select).toHaveBeenCalledWith("id,label,trial_days,duration_kind,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by");
    expect(screen.getByRole("heading", { name: "License management" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create trial code" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Code")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Trial days")[0]).toHaveAttribute("max", "7");
    expect(screen.queryByText("Batch generate license codes")).not.toBeInTheDocument();
    expect(screen.queryByText("Bulk license code actions")).not.toBeInTheDocument();
    expect(screen.queryByText("1 month")).not.toBeInTheDocument();
    expect(screen.getByText("ABCD-****-****-MNOP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deleted trial codes" })).toBeInTheDocument();
    expect(screen.getByText("WXYZ-****-****-ABCD")).toBeInTheDocument();
    expect(screen.getByText("admin-1")).toBeInTheDocument();
  });

  it("shows role editing controls on the users page only to owner admins", async () => {
    const profilesQuery = createAdminListQuery([
      {
        id: "user-1",
        email: "ada@example.com",
        display_name: "Ada Lovelace",
        admin_role: "user",
        account_status: "active",
        is_admin: false,
        created_at: "2026-04-29T00:00:00.000Z",
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? profilesQuery : ownerQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save role" })).toBeInTheDocument();
  });

  it("renders user roles as read-only on the users page for operator admins", async () => {
    const profilesQuery = createAdminListQuery([
      {
        id: "user-1",
        email: "ada@example.com",
        display_name: "Ada Lovelace",
        admin_role: "owner",
        account_status: "active",
        is_admin: true,
        created_at: "2026-04-29T00:00:00.000Z",
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const operatorQuery = createAdminListQuery({
      admin_role: "operator",
      is_admin: false,
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? profilesQuery : operatorQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save role" })).not.toBeInTheDocument();
  });

  it("renders a user operations detail page with profile, donations, certificates, trials, devices, and entitlements", async () => {
    const profileQuery = createAdminListQuery({
      id: "user-1",
      email: "ada@example.com",
      display_name: "Ada Lovelace",
      public_display_name: "Ada",
      public_supporter_enabled: true,
      admin_role: "user",
      account_status: "active",
      is_admin: false,
      created_at: "2026-04-29T00:00:00.000Z",
    });
    const donationsQuery = createAdminListQuery([
      {
        id: "donation-1",
        provider: "manual",
        status: "paid",
        amount: 5000,
        currency: "usd",
        provider_transaction_id: "manual_ada",
        paid_at: "2026-04-30T10:00:00.000Z",
        created_at: "2026-04-30T10:00:00.000Z",
      },
    ]);
    const certificatesQuery = createAdminListQuery([
      {
        id: "certificate-1",
        certificate_number: "GBAI-2026-D-000001",
        type: "donation",
        status: "active",
        issued_at: "2026-04-30T10:00:01.000Z",
      },
    ]);
    const trialsQuery = createAdminListQuery([
      {
        id: "trial-redemption-1",
        machine_code_hash: "machinehash123456",
        device_id: "MacBook",
        redeemed_at: "2026-04-30T10:01:00.000Z",
        trial_valid_until: "2026-05-03T10:01:00.000Z",
        bound_at: "2026-04-30T10:02:00.000Z",
      },
    ]);
    const sessionsQuery = createAdminListQuery([
      {
        id: "session-1",
        device_id: "MacBook",
        machine_code_hash: "machinehash123456",
        platform: "macos",
        app_version: "1.0.0",
        last_seen_at: "2026-04-30T10:03:00.000Z",
        revoked_at: null,
      },
    ]);
    const entitlementsQuery = createAdminListQuery([
      {
        id: "entitlement-1",
        feature_code: "cloud_sync",
        valid_until: "2026-05-03T10:01:00.000Z",
        status: "active",
        source_donation_id: null,
        updated_at: "2026-04-30T10:01:00.000Z",
      },
    ]);
    const leasesQuery = createAdminListQuery([
      {
        id: "lease-1",
        desktop_session_id: "session-1",
        device_id: "MacBook",
        last_heartbeat_at: "2026-04-30T10:04:00.000Z",
        expires_at: "2026-04-30T10:10:00.000Z",
        revoked_at: null,
        updated_at: "2026-04-30T10:04:00.000Z",
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table === "profiles") return profileQuery;
      if (table === "donations") return donationsQuery;
      if (table === "certificates") return certificatesQuery;
      if (table === "trial_code_redemptions") return trialsQuery;
      if (table === "desktop_sessions") return sessionsQuery;
      if (table === "license_entitlements") return entitlementsQuery;
      if (table === "cloud_sync_leases") return leasesQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
    });

    render(element);

    expect(profileQuery.select).toHaveBeenCalledWith("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,is_admin,created_at");
    expect(screen.getByRole("heading", { name: "User operations" })).toBeInTheDocument();
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Donations" })).toBeInTheDocument();
    expect(screen.getByText("manual_ada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Certificates" })).toBeInTheDocument();
    expect(screen.getByText("GBAI-2026-D-000001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trials" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unbind machine" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Desktop sessions" })).toBeInTheDocument();
    expect(screen.getAllByText("MacBook").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Entitlements" })).toBeInTheDocument();
    expect(screen.getByText("cloud_sync")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Leases" })).toBeInTheDocument();
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
