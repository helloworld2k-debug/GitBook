import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminPage from "@/app/[locale]/admin/page";
import AdminAuditLogsPage from "@/app/[locale]/admin/audit-logs/page";
import AdminCertificatesPage from "@/app/[locale]/admin/certificates/page";
import AdminDonationsPage from "@/app/[locale]/admin/donations/page";
import AdminLicensesPage from "@/app/[locale]/admin/licenses/page";
import AdminNewsPage from "@/app/[locale]/admin/news/page";
import AdminSupportFeedbackPage from "@/app/[locale]/admin/support-feedback/page";
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

vi.mock("@/app/[locale]/admin/support-feedback/support-feedback-table-row", () => ({
  SupportFeedbackTableRow: ({
    contact,
    createdAt,
    email,
    feedbackId,
    initialStatus,
    isUnread,
    message,
    subject,
  }: {
    contact: string | null;
    createdAt: string;
    email: string | null;
    feedbackId: string;
    initialStatus: string;
    isUnread: boolean;
    message: string;
    subject: string;
  }) => (
    <tr className={isUnread ? "bg-rose-50/40" : ""}>
      <td>{subject}</td>
      <td>{isUnread ? "Unread" : "-"}</td>
      <td>{email ?? "-"} {contact ?? "-"}</td>
      <td>{message}</td>
      <td>{initialStatus}</td>
      <td>{createdAt}</td>
      <td><a href={`/admin/support-feedback/${feedbackId}`}>Open thread</a></td>
    </tr>
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
  const range = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn(() => ({ range }));
  const select = vi.fn(() => ({ order }));

  return { order, select, range };
}

function createAdminListQuery(data: unknown, error: Error | null = null) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data, error })),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data, error })),
    then: (resolve: (value: { data: unknown; error: Error | null }) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve, reject),
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
      pagination: {
        previous: "Previous",
        next: "Next",
        page: "Page",
        of: "of",
      },
      overview: {
        eyebrow: "Admin tools",
        title: "Admin",
        description: "Manage contributions, certificates, releases, licenses, users, and audit activity.",
        donationsTitle: "Contributions",
        donationsDescription: "Review contribution records, statuses, and transaction IDs.",
        certificatesTitle: "Certificates",
        certificatesDescription: "Review issued certificate numbers, types, statuses, and issue dates.",
        releasesTitle: "Releases",
        releasesDescription: "Upload installers and manage releases.",
        notificationsTitle: "Notifications",
        notificationsDescription: "Publish and unpublish in-app announcements.",
        newsTitle: "News",
        newsDescription: "Create, edit, publish, and unpublish AI-generated news articles.",
        supportFeedbackTitle: "Feedback",
        supportFeedbackDescription: "Review account issue reports and support requests.",
        contributionPricingTitle: "Contribution pricing",
        contributionPricingDescription: "Manage Contributions page prices, discounts, and support tier copy.",
        supportSettingsTitle: "Support settings",
        supportSettingsDescription: "Manage public support contact channels.",
        policyPagesTitle: "Policy pages",
        policyPagesDescription: "Edit the English Terms, Privacy, and Refund pages linked from the footer.",
        licensesTitle: "Licenses",
        licensesDescription: "Create trial codes, review entitlements, and revoke desktop cloud sync access.",
        usersTitle: "Users",
        usersDescription: "Review account roles, statuses, trial bindings, and desktop devices.",
        registrationSecurityTitle: "Registration security",
        registrationSecurityDescription: "Review signup abuse patterns and block risky sources.",
        auditLogsTitle: "Audit logs",
        auditLogsDescription: "Review admin corrections, revocations, and reasons.",
        metricsTitle: "Operations overview",
        totalUsersMetric: "Total users",
        activeTrialsMetric: "Active trials",
        pendingFeedbackMetric: "Open feedback",
        recentContributionsMetric: "Recent contributions",
      },
      donations: {
        eyebrow: "Admin",
        title: "Admin contributions",
        description: "Review payment records and add verified manual contributions.",
        provider: "Provider",
        status: "Status",
        amount: "Amount",
        paidAt: "Paid at (UTC)",
        transactionId: "Transaction ID",
        manualEntryTitle: "Manual paid contribution",
        manualEntryDescription: "Create one paid manual record for an existing user by email or user ID.",
        userIdentifier: "Email or user ID",
        amountCents: "Amount (cents)",
        reference: "Reference",
        reason: "Reason",
        submitManualDonation: "Add manual contribution",
        empty: "No contributions found.",
        providers: {
          stripe: "Legacy Stripe",
          paypal: "PayPal",
          manual: "Manual",
          dodo: "Dodo Payments",
        },
        statuses: {
          pending: "Pending",
          paid: "Paid",
          cancelled: "Cancelled",
          failed: "Failed",
          refunded: "Refunded",
        },
        filter: {
          search: "Search",
          searchPlaceholder: "Search by transaction ID",
          provider: "Provider",
          allProviders: "All providers",
          status: "Status",
          allStatuses: "All statuses",
          dateFrom: "Date from",
          dateTo: "Date to",
          moreFilters: "More filters",
          apply: "Apply filters",
          reset: "Reset",
        },
        export: "Export CSV",
        exporting: "Exporting...",
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
        filter: {
          search: "Search",
          searchPlaceholder: "Search by certificate number",
          type: "Certificate type",
          allTypes: "All types",
          status: "Status",
          allStatuses: "All statuses",
          issuedFrom: "Issued from",
          issuedTo: "Issued to",
          moreFilters: "More filters",
          apply: "Apply filters",
          reset: "Reset",
        },
        export: "Export CSV",
        exporting: "Exporting...",
        selectAll: "Select all",
        selectedCount: "{count} selected",
        exportSelected: "Export selected",
        clearSelection: "Clear selection",
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
        filter: {
          search: "Search",
          searchPlaceholder: "Search by action, target ID, or reason",
          action: "Action type",
          allActions: "All actions",
          target: "Target type",
          allTargets: "All targets",
          dateFrom: "Date from",
          dateTo: "Date to",
          moreFilters: "More filters",
          apply: "Apply filters",
          reset: "Reset",
        },
      },
      news: {
        eyebrow: "Admin",
        title: "News",
        description: "Create, edit, publish, and unpublish AI-generated news articles.",
        createTitle: "Create article",
        editTitle: "Edit articles",
        slug: "Slug",
        titleLabel: "Title",
        summary: "Summary",
        body: "Body",
        topic: "Topic",
        coverImagePath: "Cover image path",
        imageAlt: "Image alt text",
        publishNow: "Publish now",
        create: "Create article",
        save: "Save article",
        status: "Status",
        published: "Published",
        draft: "Draft",
        publishedAt: "Published",
        updatedAt: "Updated",
        viewPublic: "View public",
        publish: "Publish",
        unpublish: "Unpublish",
        empty: "No news articles found.",
        aiGenerated: "AI-created",
        loadFailed: "News articles could not be loaded. You can still create a new article.",
      },
      supportFeedback: {
        eyebrow: "Admin",
        title: "Support feedback",
        description: "Review account issue reports submitted through the support page.",
        subject: "Subject",
        contact: "Contact",
        message: "Message",
        status: "Status",
        createdAt: "Created",
        save: "Save",
        empty: "No feedback found.",
        searchPlaceholder: "Search by subject, message, or email",
        view: "Open thread",
        allFeedback: "All feedback",
        unread: "Unread",
        unreadFeedback: "Unread feedback",
        confirmChange: "Change feedback status from {old} to {new}?",
        statuses: {
          open: "Open",
          reviewing: "Reviewing",
          closed: "Closed",
        },
      },
      licenses: {
        eyebrow: "Admin",
        title: "License management",
        description: "Generate, filter, reveal, and maintain channel license code batches.",
        cloudSyncCooldownTitle: "Cloud sync device switch cooldown",
        cloudSyncCooldownDescription: "Set how long a newly logged-in device must wait after another device releases cloud sync.",
        cloudSyncUsageSignalsTitle: "Cloud sync usage signals",
        cloudSyncUsageSignalsDescription: "Track active sync sessions, total usage duration, and multi-device sync attempts.",
        totalUsage: "Total usage",
        activeSyncSessionsLabel: "Active sessions",
        activeSyncSessions: "active sync sessions",
        conflicts: "Conflicts",
        conflictAttempts: "conflict attempts",
        cooldownBlocks: "Cooldown blocks",
        cooldownMinutes: "Cooldown minutes",
        cooldownReasonPlaceholder: "Reason for this operational change",
        reason: "Reason",
        trialDays: "Trial days",
        fixedPaidDurationsHelp: "Monthly codes use a fixed 30-day duration. Quarterly uses 90 days; yearly uses 365 days.",
        label: "Batch name",
        batchGenerateTitle: "Batch generate license codes",
        batchGenerateDescription: "Generate trial, monthly, quarterly, or yearly license codes.",
        generateBatch: "Generate codes",
        batchesTitle: "License batches",
        licenseCodesTitle: "License codes",
        search: "Search",
        searchPlaceholder: "Search labels, codes, notes",
        channel: "Channel",
        allChannels: "All channels",
        allDurations: "All durations",
        allStatuses: "All statuses",
        allRedemptions: "All redemptions",
        moreFilters: "More filters",
        deleted: "Deleted",
        currentOnly: "Current only",
        deletedOnly: "Deleted only",
        currentAndDeleted: "Current and deleted",
        createdFrom: "Created from",
        createdTo: "Created to",
        applyFilters: "Apply filters",
        resetFilters: "Reset filters",
        applyMetadata: "Apply channel",
        clearSelection: "Clear selection",
        selectedCount: "{count} selected",
        selectAll: "Select all license codes",
        securitySignalsTitle: "Security signals",
        securitySignalsDescription: "Review recent license code redemption failures, blocks, and suspicious IP activity.",
        failedAttempts: "Failed attempts",
        blockedAttempts: "Blocked attempts",
        topRiskIp: "Top risk IP",
        generatedBy: "Generated by",
        emptyBatches: "No license batches found.",
        emptyLicenseCodes: "No license codes found.",
        code: "Code",
        duration: "Duration",
        durationTrial: "Trial",
        durationMonth1: "1 month",
        durationMonth3: "3 months",
        durationYear1: "1 year",
        quantity: "Quantity",
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
        copy: "Copy code",
        copied: "Copied",
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
        redeemed: "Redeemed",
        unredeemed: "Unredeemed",
        durations: {
          trial_3_day: "Trial",
          month_1: "1 month",
          month_3: "3 months",
          year_1: "1 year",
        },
        channels: {
          internal: "Internal",
          taobao: "Taobao",
          xianyu: "Xianyu",
          partner: "Partner",
          other: "Other",
        },
      },
      users: {
        eyebrow: "Admin",
        title: "User management",
        detailTitle: "User operations",
        detailDescription: "Review and maintain one user's profile, donations, certificates, trials, devices, and entitlements.",
        accountCreationTitle: "Create account",
        accountCreationDescription: "Invite a user or create a confirmed account with a temporary password.",
        creationMode: "Creation mode",
        inviteMode: "Invite email",
        tempPasswordMode: "Temporary password",
        email: "Email",
        userId: "User ID",
        temporaryPassword: "Temporary password",
        generatePassword: "Generate password",
        createInvite: "Send invite",
        createTempAccount: "Create account",
        authStatus: "Auth status",
        authConfirmed: "Email confirmed",
        authUnconfirmed: "Email unconfirmed",
        authInvited: "Invited",
        authHasPassword: "Password set",
        authNoPassword: "No password",
        authRecoverySent: "Password email sent",
        authLastSignIn: "Last sign-in",
        passwordRecoveryTitle: "Password and invitation recovery",
        passwordRecoveryDescription: "This account needs a password before it can use email sign-in.",
        sendPasswordSetup: "Send password setup email",
        setTemporaryPassword: "Set temporary password",
        manageUser: "Manage user",
        moreActions: "More actions",
        detailEntryHint: "Detailed account, contributions, certificates, and devices",
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
        search: "Search users",
        searchPlaceholder: "Email, display name, or user ID",
        applyFilters: "Apply",
        reset: "Reset",
        filterRole: "Permission",
        filterType: "User type",
        filterStatus: "Status",
        moreFilters: "More filters",
        sortBy: "Sort by",
        sortOrder: "Sort order",
        export: "Export CSV",
        archiveEntry: "Archive",
        archiveEntryDescription: "Restore archived users or permanently delete records from the user archive.",
        allRoles: "All permissions",
        allTypes: "All user types",
        allStatuses: "All statuses",
        createdFrom: "Registered from",
        createdTo: "Registered to",
        selectAll: "Select all users",
        selectedCount: "{count} selected",
        bulkEnable: "Bulk enable",
        bulkDisable: "Bulk disable",
        bulkChangeRole: "Bulk change role",
        bulkSoftDelete: "Bulk soft delete",
        bulkSoftDeleteSelected: "Bulk soft delete selected users",
        bulkArchiveDelete: "Bulk archive delete",
        bulkArchiveDeleteSelected: "Bulk archive delete selected users",
        clearSelection: "Clear selection",
        bulkEnableConfirm: "Confirm enabling {n} users?",
        bulkDisableConfirm: "Confirm disabling {n} users?",
        bulkRoleConfirm: "Confirm changing role for {n} users?",
        roleTarget: "Target role",
        summaryTotal: "Total users",
        summaryActive: "Active users",
        summaryDisabled: "Disabled users",
        summaryElevated: "Elevated users",
        actions: "Actions",
        type: "Type",
        devicesAndTrials: "Devices / trials",
        createdAt: "Created",
        standardType: "Standard",
        adminType: "Admin",
        emptyFiltered: "No users match the current filters.",
        softDelete: "Soft delete",
        ownerPill: "Owner access",
        operatorPill: "Operator access",
        userPill: "Standard user",
        deletedPill: "Soft-deleted",
        dangerZone: "Danger zone",
        dangerDescription: "Permanently deleting a user removes the profile and cannot be undone.",
        dangerWarning: "Only use this when the account must be fully erased.",
        deleteConfirmation: "Type DELETE or the user email to confirm",
        permanentDelete: "Permanent delete",
        deleting: "Deleting...",
        acceptedConfirmation: "Accepted confirmation values:",
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
        loginHistoryTitle: "Login history",
        loginHistoryDescription: "Recent login attempts for this user.",
        loginHistoryEmpty: "No login history recorded yet.",
        loginHistoryTime: "Time",
        loginHistoryStatus: "Status",
        loginHistoryIP: "IP address",
        loginHistoryMethod: "Method",
        loginHistorySuccess: "Success",
        loginHistoryFailed: "Failed",
        timelineTitle: "Account timeline",
        timelineEmpty: "No timeline activity yet.",
        timelineDonation: "Contribution",
        timelineCertificate: "Certificate",
        timelineTrial: "Trial redeemed",
        timelineSession: "Desktop session",
        timelineEntitlement: "Entitlement",
        timelineLease: "Cloud sync lease",
        timelineFeedback: "Support feedback",
        releasedAt: "Released at",
        cooldownUntil: "Cooldown until",
        overrideExpiresAt: "Override expires",
        overrideReason: "Override reason",
        grantOverride: "Grant cooldown override",
        overrideActive: "Temporary override active",
        overrideConsumed: "Temporary override used",
        overrideConsumedAt: "Used at",
        cloudSyncUsageTitle: "Cloud sync usage",
        cloudSyncUsageDescription: "Review usage duration, current device state, and multi-device sync attempts.",
        cloudSyncUsageActive: "Sync active",
        cloudSyncUsageInactive: "Sync inactive",
        cloudSyncUsageTotal: "Total usage",
        cloudSyncUsageMachines: "Machines",
        cloudSyncUsageConflicts: "Conflicts",
        cloudSyncUsageCooldowns: "Cooldowns",
        cloudSyncUsageLatest: "Latest start",
        cloudSyncUsageConflictAttempts: "conflict attempts",
        cloudSyncUsageCooldownBlocks: "cooldown blocks",
        cloudSyncUsageStarted: "Started",
        cloudSyncUsageLastHeartbeat: "Last heartbeat",
        cloudSyncUsageEnded: "Ended",
        cloudSyncUsageEndReason: "End reason",
        cloudSyncUsageStillActive: "still active",
        cloudSyncUsageEmpty: "No cloud sync usage sessions yet.",
        cloudSyncUsageEvents: "Recent sync events",
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
          deleted: "Deleted",
        },
        description: "Review account roles, statuses, trial bindings, and desktop devices.",
      },
      shell: {
        auditLogs: "Audit Logs",
        archivedUsers: "Archived Users",
        backToAdmin: "Back to admin",
        certificates: "Certificates",
        contributionPricing: "Contribution pricing",
        dashboard: "Overview",
        donations: "Donations",
        language: "Language",
        licenses: "Licenses",
        menu: "Menu",
        news: "News",
        notifications: "Notifications",
        policies: "Policy pages",
        registrationSecurity: "Registration security",
        releases: "Releases",
        returnToSite: "Return to site",
        signOut: "Sign out",
        supportFeedback: "Feedback",
        supportSettings: "Support settings",
        users: "Users",
      },
    },
  },
  "zh": {
    admin: {
      common: {
        processing: "处理中...",
        saving: "储存中...",
      },
      pagination: {
        previous: "上一页",
        next: "下一页",
        page: "第",
        of: "页，共",
      },
      overview: {
        eyebrow: "管理工具",
        title: "管理后台",
        description: "管理支持记录、证书、版本、兑换、用户与稽核活动。",
        donationsTitle: "支持",
        donationsDescription: "检视支持记录、状态与交易 ID。",
        certificatesTitle: "证书",
        certificatesDescription: "检视已颁发的证书编号、类型、状态与颁发日期。",
        releasesTitle: "版本发布",
        releasesDescription: "上传安装包并管理版本。",
        notificationsTitle: "通知",
        notificationsDescription: "发布与下架站内通知。",
        newsTitle: "新闻",
        newsDescription: "建立、编辑、发布与下架 AI 生成新闻文章。",
        supportFeedbackTitle: "回馈",
        supportFeedbackDescription: "检视帐号问题与支援请求。",
        contributionPricingTitle: "支持价格设定",
        contributionPricingDescription: "管理 Contributions 页面的价格、折扣与开发支持方案文案。",
        supportSettingsTitle: "支援设定",
        supportSettingsDescription: "管理公开支援联络渠道。",
        policyPagesTitle: "Policy pages",
        policyPagesDescription: "Edit the English Terms, Privacy, and Refund pages linked from the footer.",
        licensesTitle: "兑换",
        licensesDescription: "建立试用兑换码、检视权益，并撤销桌面云端同步存取。",
        usersTitle: "用户",
        usersDescription: "检视帐号角色、状态、试用绑定与桌面装置。",
        registrationSecurityTitle: "注册安全",
        registrationSecurityDescription: "检视注册滥用讯号并封锁可疑来源。",
        auditLogsTitle: "稽核纪录",
        auditLogsDescription: "检视管理员修正、撤销与原因。",
        metricsTitle: "营运概览",
        totalUsersMetric: "用户总数",
        activeTrialsMetric: "启用中的试用码",
        pendingFeedbackMetric: "待处理回馈",
        recentContributionsMetric: "近期支持",
      },
      donations: {
        eyebrow: "管理后台",
        title: "管理支持记录",
        description: "检视付款记录，并新增已验证的人工支持。",
        provider: "服务商",
        status: "状态",
        amount: "金额",
        paidAt: "付款时间（UTC）",
        transactionId: "交易 ID",
        manualEntryTitle: "人工已付款支持记录",
        manualEntryDescription: "为既有用户以电子邮件或用户 ID 建立一笔已付款人工记录。",
        userIdentifier: "电子邮件或用户 ID",
        amountCents: "金额（美分）",
        reference: "参考编号",
        reason: "原因",
        submitManualDonation: "新增人工支持记录",
        empty: "尚无支持记录。",
        providers: {
          stripe: "旧版 Stripe",
          paypal: "PayPal",
          manual: "人工登录",
          dodo: "Dodo Payments",
        },
        statuses: {
          pending: "待处理",
          paid: "已付款",
          cancelled: "已取消",
          failed: "失败",
          refunded: "已退款",
        },
        filter: {
          search: "搜寻",
          searchPlaceholder: "依交易 ID 搜寻",
          provider: "服务商",
          allProviders: "所有服务商",
          status: "状态",
          allStatuses: "所有状态",
          dateFrom: "日期从",
          dateTo: "日期到",
          moreFilters: "更多筛选",
          apply: "套用筛选",
          reset: "重设",
        },
        export: "Export CSV",
        exporting: "Exporting...",
      },
      certificates: {
        eyebrow: "管理后台",
        title: "管理证书",
        description: "检视已颁发证书，必要时撤销记录。",
        certificateNumber: "证书编号",
        type: "类型",
        status: "状态",
        issued: "颁发日期",
        action: "操作",
        revokeReason: "原因",
        revoke: "撤销",
        revokeAriaLabel: "撤销证书 {certificateNumber}",
        notIssued: "尚未颁发",
        empty: "尚无证书。",
        types: {
          donation: "捐赠证书",
          honor: "荣誉证书",
        },
        statuses: {
          active: "有效",
          revoked: "已撤销",
          generation_failed: "产生失败",
        },
        filter: {
          search: "搜寻",
          searchPlaceholder: "依证书编号搜寻",
          type: "证书类型",
          allTypes: "所有类型",
          status: "状态",
          allStatuses: "所有状态",
          issuedFrom: "颁发日期从",
          issuedTo: "颁发日期到",
          moreFilters: "更多筛选",
          apply: "套用筛选",
          reset: "重设",
        },
        export: "Export CSV",
        exporting: "Exporting...",
        selectAll: "Select all",
        selectedCount: "{count} selected",
        exportSelected: "Export selected",
        clearSelection: "Clear selection",
      },
      auditLogs: {
        eyebrow: "管理后台",
        title: "稽核纪录",
        description: "检视管理变更与支援操作。",
        action: "操作",
        target: "目标",
        reason: "原因",
        createdAt: "建立时间",
        admin: "管理员",
        empty: "尚无稽核纪录。",
      },
      shell: {
        auditLogs: "稽核纪录",
        backToAdmin: "返回管理首页",
        certificates: "证书",
        contributionPricing: "支持价格设定",
        dashboard: "总览",
        donations: "支持",
        language: "语言",
        licenses: "兑换",
        menu: "选单",
        news: "新闻",
        notifications: "通知",
        policies: "Policy pages",
        registrationSecurity: "注册安全",
        releases: "版本发布",
        returnToSite: "返回网站",
        signOut: "登出",
        supportFeedback: "回馈",
        supportSettings: "支援设定",
        users: "用户",
      },
    },
  }

};

describe("admin pages", () => {
  beforeEach(() => {
    intlState.locale = "en";
    requireAdminMock.mockReset().mockResolvedValue({ id: "admin-1" });
    createSupabaseServerClientMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
  });

  it("renders the guarded admin overview with admin tool links", async () => {
    const countQuery = (count: number) => {
      const query = {
        eq: vi.fn(() => query),
        gte: vi.fn(() => query),
        is: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve({ count, data: [], error: null })),
        select: vi.fn(() => query),
      };

      return query;
    };
    const from = vi.fn((table: string) => {
      if (table === "profiles") return countQuery(12);
      if (table === "trial_codes") return countQuery(4);
      if (table === "support_feedback") return countQuery(3);
      if (table === "donations") return countQuery(7);
      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en", "/en/admin");
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /donations/i }).some((link) => link.getAttribute("href") === "/admin/donations")).toBe(true);
    expect(screen.getAllByRole("link", { name: /certificates/i }).some((link) => link.getAttribute("href") === "/admin/certificates")).toBe(true);
    expect(screen.getAllByRole("link", { name: /releases/i }).some((link) => link.getAttribute("href") === "/admin/releases")).toBe(true);
    expect(screen.getAllByRole("link", { name: /news/i }).some((link) => link.getAttribute("href") === "/admin/news")).toBe(true);
    expect(screen.getAllByRole("link", { name: /registration security/i }).some((link) => link.getAttribute("href") === "/admin/registration-security")).toBe(true);
    expect(screen.getAllByRole("link", { name: /audit logs/i }).some((link) => link.getAttribute("href") === "/admin/audit-logs")).toBe(true);
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
    expect(createSupabaseAdminClientMock).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Operations overview" })).toBeInTheDocument();
    expect(screen.getByText("Total users")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Open feedback")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders localized admin overview copy beyond English", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "zh" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh", "/zh/admin");
    expect(screen.getByText("管理工具")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "管理后台" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /支持/ }).some((link) => link.getAttribute("href") === "/admin/donations")).toBe(true);
    expect(screen.getAllByRole("link", { name: /版本发布/ }).some((link) => link.getAttribute("href") === "/admin/releases")).toBe(true);
    expect(screen.getAllByRole("link", { name: /稽核纪录/ }).some((link) => link.getAttribute("href") === "/admin/audit-logs")).toBe(true);
    expect(screen.getByText("检视支持记录、状态与交易 ID。")).toBeInTheDocument();
  });

  it("renders the admin news publishing page with draft and published articles", async () => {
    const newsQuery = createAdminListQuery([
      {
        id: "news-1",
        slug: "vision-foundation-models-enter-the-field",
        title: "Vision Foundation Models Enter the Field",
        summary: "AI-generated visual systems are moving from labs into field workflows.",
        topic: "vision foundation models",
        cover_image_path: "/news/vision-foundation-models-enter-the-field.webp",
        published_at: "2026-05-01T10:00:00.000Z",
        updated_at: "2026-05-01T10:00:00.000Z",
      },
      {
        id: "news-2",
        slug: "draft-article",
        title: "Draft Article",
        summary: "A draft AI article.",
        topic: "drafts",
        cover_image_path: "/news/draft-article.webp",
        published_at: null,
        updated_at: "2026-05-02T10:00:00.000Z",
      },
    ]);

    createSupabaseAdminClientMock.mockReturnValue({
      from: (table: string) => {
        if (table !== "news_articles") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return newsQuery;
      },
    });

    render(await AdminNewsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(requireAdminMock).toHaveBeenCalledWith("en", "/en/admin/news");
    expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument();
    expect(screen.getAllByText("Create article").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("vision-foundation-models-enter-the-field")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
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

    const element = await AdminDonationsPage({ params: Promise.resolve({ locale: "zh" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh", "/zh/admin/donations");
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("donations");
    expect(donationsQuery.select).toHaveBeenCalledWith("id,provider,status,amount,currency,provider_transaction_id,paid_at,created_at");
    expect(donationsQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "管理支持记录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "人工已付款支持记录" })).toBeInTheDocument();
    expect(screen.getByLabelText("电子邮件或用户 ID")).toBeRequired();
    expect(screen.getByLabelText("原因")).toBeRequired();
    expect(screen.getByRole("button", { name: "新增人工支持记录" })).toBeInTheDocument();
    expect(screen.getAllByText("旧版 Stripe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("人工登录").length).toBeGreaterThan(0);
    expect(screen.queryByText("stripe")).not.toBeInTheDocument();
    expect(screen.queryByText("manual")).not.toBeInTheDocument();
    expect(screen.getAllByText("已付款").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已退款").length).toBeGreaterThan(0);
    expect(screen.queryByText("paid")).not.toBeInTheDocument();
    expect(screen.getAllByText("US$50.00 USD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("txn_123").length).toBeGreaterThan(0);
    expect(screen.getAllByText("manual_456").length).toBeGreaterThan(0);
    expect(screen.getByTestId("admin-mobile-cards")).toHaveTextContent("txn_123");
  });

  it("renders support feedback in a mobile-safe card list", async () => {
    const feedbackQuery = createAdminListQuery([
      {
        id: "feedback-1",
        email: "ada@example.com",
        contact: "telegram",
        subject: "Cannot redeem trial",
        message: "The redeem button fails on mobile.",
        status: "open",
        created_at: "2026-05-01T10:00:00.000Z",
        updated_at: "2026-05-01T10:00:00.000Z",
        support_feedback_admin_reads: [],
        support_feedback_messages: [
          {
            author_role: "user",
            created_at: "2026-05-01T10:05:00.000Z",
          },
        ],
      },
    ]);
    const from = vi.fn(() => feedbackQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminSupportFeedbackPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(from).toHaveBeenCalledWith("support_feedback");
    expect(screen.getByRole("table", { name: "Support feedback" })).toHaveClass("min-w-[1540px]", "table-fixed");
    expect(screen.getByRole("columnheader", { name: "Action" })).not.toHaveClass("sticky");
    expect(screen.getAllByText("Unread").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Unread feedback" })).toHaveAttribute("href", "/admin/support-feedback?filter=unread");
    expect(screen.getByTestId("admin-mobile-cards")).toHaveTextContent("Cannot redeem trial");
    expect(screen.getAllByRole("link", { name: "Open thread" })[0]).toHaveAttribute("href", "/admin/support-feedback/feedback-1");
  });

  it("opens support feedback when unread tracking relation is unavailable", async () => {
    const unreadRelationError = {
      code: "PGRST200",
      message: "Could not find a relationship between support_feedback and support_feedback_admin_reads in the schema cache",
    } as Error;
    const enhancedFeedbackQuery = createAdminListQuery(null, unreadRelationError);
    const basicFeedbackQuery = createAdminListQuery([
      {
        id: "feedback-1",
        email: "ada@example.com",
        contact: "telegram",
        subject: "Cannot redeem trial",
        message: "The redeem button fails on mobile.",
        status: "open",
        created_at: "2026-05-01T10:00:00.000Z",
        updated_at: "2026-05-01T10:00:00.000Z",
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table !== "support_feedback") return createAdminListQuery([]);

      return from.mock.calls.filter(([name]) => name === "support_feedback").length === 1
        ? enhancedFeedbackQuery
        : basicFeedbackQuery;
    });
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminSupportFeedbackPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(enhancedFeedbackQuery.select).toHaveBeenCalledWith(
      "id,email,contact,subject,message,status,created_at,updated_at,support_feedback_admin_reads(admin_user_id,read_at),support_feedback_messages(author_role,created_at)",
    );
    expect(basicFeedbackQuery.select).toHaveBeenCalledWith("id,email,contact,subject,message,status,created_at,updated_at");
    expect(screen.getAllByText("Cannot redeem trial").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unread")).toHaveLength(1);
  });

  it("filters support feedback to unread threads", async () => {
    const feedbackQuery = createAdminListQuery([
      {
        id: "feedback-read",
        email: "read@example.com",
        contact: null,
        subject: "Already read",
        message: "Old message",
        status: "reviewing",
        created_at: "2026-05-01T09:00:00.000Z",
        updated_at: "2026-05-01T09:00:00.000Z",
        support_feedback_admin_reads: [{ admin_user_id: "admin-1", read_at: "2026-05-01T09:10:00.000Z" }],
        support_feedback_messages: [{ author_role: "user", created_at: "2026-05-01T09:05:00.000Z" }],
      },
      {
        id: "feedback-unread",
        email: "unread@example.com",
        contact: null,
        subject: "Needs attention",
        message: "New message",
        status: "open",
        created_at: "2026-05-01T10:00:00.000Z",
        updated_at: "2026-05-01T10:00:00.000Z",
        support_feedback_admin_reads: [],
        support_feedback_messages: [{ author_role: "user", created_at: "2026-05-01T10:05:00.000Z" }],
      },
    ]);
    const from = vi.fn(() => feedbackQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminSupportFeedbackPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ filter: "unread" }),
    });

    render(element);

    expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(0);
    expect(screen.queryByText("Already read")).not.toBeInTheDocument();
  });

  it("renders Chinese admin donation enum labels", async () => {
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

    const element = await AdminDonationsPage({ params: Promise.resolve({ locale: "zh" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh", "/zh/admin/donations");
    expect(screen.getByRole("heading", { name: "管理支持记录" })).toBeInTheDocument();
    expect(screen.getAllByText("PayPal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已取消").length).toBeGreaterThan(0);
    expect(screen.queryByText("paypal")).not.toBeInTheDocument();
    expect(screen.queryByText("cancelled")).not.toBeInTheDocument();
    expect(screen.getAllByText("US$35.00 USD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("paypal_txn_789").length).toBeGreaterThan(0);
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

    const element = await AdminCertificatesPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en", "/en/admin/certificates");
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("certificates");
    expect(certificatesQuery.select).toHaveBeenCalledWith("id,certificate_number,type,status,issued_at");
    expect(certificatesQuery.order).toHaveBeenCalledWith("issued_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "Admin certificates" })).toBeInTheDocument();
    expect(screen.getByText("Certificate number")).toBeInTheDocument();
    expect(screen.getByText("DON-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Donation Certificate")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.queryByText("donation")).not.toBeInTheDocument();
    expect(screen.queryByText("active")).not.toBeInTheDocument();
    expect(screen.getByText("Apr 29, 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toBeRequired();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("renders Chinese admin certificate enum labels", async () => {
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

    const element = await AdminCertificatesPage({ params: Promise.resolve({ locale: "zh" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh", "/zh/admin/certificates");
    expect(screen.getByRole("heading", { name: "管理证书" })).toBeInTheDocument();
    expect(screen.getByText("HON-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("荣誉证书")).toBeInTheDocument();
    expect(screen.getByText("已撤销")).toBeInTheDocument();
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

  it("renders license batch generation, filters, and bulk-maintenance controls", async () => {
    const batchesQuery = createAdminListQuery([
      {
        id: "batch-1",
        label: "Taobao May monthly",
        channel_type: "taobao",
        channel_note: null,
        duration_kind: "month_1",
        trial_days: 30,
        code_count: 1,
        created_by: "admin-1",
        created_at: "2026-05-01T10:00:00.000Z",
        deleted_at: null,
        updated_by: null,
      },
    ]);
    const codesQuery = createAdminListQuery([
      {
        id: "license-code-1",
        label: "Taobao May monthly",
        trial_days: 30,
        duration_kind: "month_1",
        channel_type: "taobao",
        channel_note: null,
        code_mask: "1MAB-****-****-MNOP",
        batch_id: "batch-1",
        max_redemptions: 1,
        redemption_count: 0,
        is_active: true,
        updated_by: null,
        created_by: "admin-1",
        created_at: "2026-04-01T10:00:00.000Z",
        deleted_at: null,
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const redeemAttemptsQuery = createAdminListQuery([
      {
        code_hash: "hash-1",
        created_at: "2026-05-01T11:00:00.000Z",
        id: "attempt-1",
        ip_address: "203.0.113.10",
        reason: "trial_code_invalid",
        result: "failure",
        user_agent: "Vitest",
        user_id: "user-1",
      },
    ]);
    const cooldownSettingQuery = createAdminListQuery({
      key: "cloud_sync_device_switch_cooldown_minutes",
      value: "180",
    });
    const usageSessionsQuery = createAdminListQuery([
      {
        id: "usage-1",
        user_id: "user-1",
        device_id: "MacBook",
        machine_code_hash: "machinehash123456",
        started_at: "2026-05-01T00:00:00.000Z",
        last_heartbeat_at: "2026-05-01T00:30:00.000Z",
        ended_at: null,
        end_reason: null,
      },
    ]);
    const usageEventsQuery = createAdminListQuery([
      {
        id: "event-1",
        user_id: "user-1",
        event_type: "activate_conflict",
        reason: "active_on_another_device",
        device_id: "Windows PC",
        machine_code_hash: "othermachine123456",
        occurred_at: "2026-05-01T00:10:00.000Z",
      },
    ]);
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_settings") return cooldownSettingQuery;
      if (table === "license_code_batches") return batchesQuery;
      if (table === "license_code_redeem_attempts") return redeemAttemptsQuery;
      if (table === "cloud_sync_usage_sessions") return usageSessionsQuery;
      if (table === "cloud_sync_usage_events") return usageEventsQuery;
      if (table === "trial_codes") return codesQuery;
      return emptyQuery;
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminLicensesPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(from).toHaveBeenCalledWith("trial_codes");
    expect(from).toHaveBeenCalledWith("license_code_batches");
    expect(from).toHaveBeenCalledWith("license_code_redeem_attempts");
    expect(codesQuery.select).toHaveBeenCalledWith("id,batch_id,label,trial_days,duration_kind,channel_type,channel_note,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by,created_by");
    expect(screen.getByRole("heading", { name: "License management" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Batch generate license codes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Batch name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Channel note")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Trial days")[0]).toHaveAttribute("max", "7");
    expect(screen.getByText("Monthly codes use a fixed 30-day duration. Quarterly uses 90 days; yearly uses 365 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate codes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "License batches" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Security signals" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloud sync usage signals" })).toBeInTheDocument();
    expect(screen.getAllByText("1 active sync sessions").length).toBeGreaterThan(0);
    expect(screen.getByText("1 conflict attempts")).toBeInTheDocument();
    expect(screen.getByText("Failed attempts")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("203.0.113.10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Taobao May monthly").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1MAB-****-****-MNOP").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Reveal" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: "Select all license codes" })).toBeInTheDocument();

    const licenseCodesTable = screen.getByRole("table", { name: "License codes" });
    expect(licenseCodesTable).toHaveClass("min-w-[1560px]", "table-fixed");
    expect(screen.getAllByRole("table", { name: "License codes" })).toHaveLength(1);
    expect(screen.getAllByTestId("admin-table-shell")[0]).toHaveClass("overflow-x-auto", "overscroll-x-contain");
    expect(screen.getAllByRole("columnheader", { name: "Action" }).some((header) => header.className.includes("sticky") && header.className.includes("right-0"))).toBe(true);
  });

  it("keeps license management available when the batch table migration has not reached Supabase yet", async () => {
    const batchesQuery = createAdminListQuery(null, {
      code: "42P01",
      message: "relation public.license_code_batches does not exist",
    } as Error);
    const codesQuery = createAdminListQuery([
      {
        id: "license-code-1",
        label: "Existing trial",
        trial_days: 3,
        duration_kind: "trial_3_day",
        channel_type: null,
        channel_note: null,
        code_mask: "T3AB-****-****-MNOP",
        batch_id: null,
        max_redemptions: 1,
        redemption_count: 0,
        is_active: true,
        updated_by: null,
        created_by: "admin-1",
        created_at: "2026-05-01T10:00:00.000Z",
        deleted_at: null,
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const cooldownSettingQuery = createAdminListQuery({
      key: "cloud_sync_device_switch_cooldown_minutes",
      value: "180",
    });
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_settings") return cooldownSettingQuery;
      if (table === "license_code_batches") return batchesQuery;
      if (table === "trial_codes") return codesQuery;
      return emptyQuery;
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminLicensesPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(screen.getByRole("heading", { name: "License management" })).toBeInTheDocument();
    expect(screen.getByText("T3AB-****-****-MNOP")).toBeInTheDocument();
    expect(screen.getByText("No license batches found.")).toBeInTheDocument();
  });

  it("keeps license management available when optional cloud sync usage tables are unavailable", async () => {
    const optionalUsageTableError = {
      code: "42P01",
      message: "relation public.cloud_sync_usage_sessions does not exist",
    } as Error;
    const batchesQuery = createAdminListQuery([
      {
        id: "batch-1",
        label: "Partner monthly",
        channel_type: "partner",
        channel_note: null,
        duration_kind: "month_1",
        trial_days: 30,
        code_count: 1,
        created_by: "admin-1",
        created_at: "2026-05-01T10:00:00.000Z",
        deleted_at: null,
        updated_by: null,
      },
    ]);
    const codesQuery = createAdminListQuery([
      {
        id: "license-code-1",
        label: "Partner monthly",
        trial_days: 30,
        duration_kind: "month_1",
        channel_type: "partner",
        channel_note: null,
        code_mask: "1MAB-****-****-MNOP",
        batch_id: "batch-1",
        max_redemptions: 1,
        redemption_count: 0,
        is_active: true,
        updated_by: null,
        created_by: "admin-1",
        created_at: "2026-05-01T10:00:00.000Z",
        deleted_at: null,
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const missingUsageQuery = createAdminListQuery(null, optionalUsageTableError);
    const cooldownSettingQuery = createAdminListQuery({
      key: "cloud_sync_device_switch_cooldown_minutes",
      value: "180",
    });
    const from = vi.fn((table: string) => {
      if (table === "cloud_sync_settings") return cooldownSettingQuery;
      if (table === "license_code_batches") return batchesQuery;
      if (table === "trial_codes") return codesQuery;
      if (table === "cloud_sync_usage_sessions" || table === "cloud_sync_usage_events") return missingUsageQuery;
      return emptyQuery;
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminLicensesPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(screen.getByRole("heading", { name: "License management" })).toBeInTheDocument();
    expect(screen.getAllByText("Partner monthly").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1MAB-****-****-MNOP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0 active sync sessions").length).toBeGreaterThan(0);
  });

  it("shows role editing controls on the users page only to owner admins", async () => {
    const paginatedRpcResult = [
      {
        users: [
          {
            id: "user-1",
            email: "ada@example.com",
            display_name: "Ada Lovelace",
            admin_role: "user",
            account_status: "active",
            is_admin: false,
            avatar_url: null,
            created_at: "2026-04-29T00:00:00.000Z",
          },
        ],
        total_count: 1,
        filtered_count: 1,
      },
    ];
    const authStatusRpcResult = [
      {
        user_id: "user-1",
        email_confirmed_at: "2026-05-01T00:00:00.000Z",
        confirmed_at: null,
        invited_at: null,
        has_password: true,
        recovery_sent_at: null,
        last_sign_in_at: "2026-05-01T00:00:00.000Z",
      },
    ];
    const rpc = vi.fn((fnName: string) => {
      if (fnName === "get_admin_users_paginated") {
        return Promise.resolve({ data: paginatedRpcResult, error: null });
      }
      if (fnName === "get_admin_auth_user_status") {
        return Promise.resolve({ data: authStatusRpcResult, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    });
    const emptyQuery = createAdminListQuery([]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? ownerQuery : ownerQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save role" })).toBeInTheDocument();
  });

  it("renders user roles as read-only on the users page for operator admins", async () => {
    const paginatedRpcResult = [
      {
        users: [
          {
            id: "user-1",
            email: "ada@example.com",
            display_name: "Ada Lovelace",
            admin_role: "owner",
            account_status: "active",
            is_admin: true,
            avatar_url: null,
            created_at: "2026-04-29T00:00:00.000Z",
          },
        ],
        total_count: 1,
        filtered_count: 1,
      },
    ];
    const authStatusRpcResult = [
      {
        user_id: "user-1",
        email_confirmed_at: "2026-05-01T00:00:00.000Z",
        confirmed_at: null,
        invited_at: null,
        has_password: true,
        recovery_sent_at: null,
        last_sign_in_at: "2026-05-01T00:00:00.000Z",
      },
    ];
    const rpc = vi.fn((fnName: string) => {
      if (fnName === "get_admin_users_paginated") {
        return Promise.resolve({ data: paginatedRpcResult, error: null });
      }
      if (fnName === "get_admin_auth_user_status") {
        return Promise.resolve({ data: authStatusRpcResult, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    });
    const emptyQuery = createAdminListQuery([]);
    const operatorQuery = createAdminListQuery({
      admin_role: "operator",
      is_admin: false,
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? operatorQuery : operatorQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save role" })).not.toBeInTheDocument();
  });

  it("shows account creation controls and auth status on the users page", async () => {
    const users = [
      {
        id: "user-1",
        email: "invited@example.com",
        display_name: "Invited User",
        admin_role: "user",
        account_status: "active",
        is_admin: false,
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ];
    const emptyQuery = createAdminListQuery([]);
    const operatorQuery = createAdminListQuery({
      admin_role: "operator",
      is_admin: false,
      account_status: "active",
    });
    const rpc = vi.fn((fnName: string) => {
      if (fnName === "get_admin_users_paginated") {
        return Promise.resolve({
          data: [
            {
              users,
              total_count: 1,
              filtered_count: 1,
            },
          ],
          error: null,
        });
      }

      if (fnName === "get_admin_auth_user_status") {
        return Promise.resolve({
          data: [
        {
          user_id: "user-1",
          email: "invited@example.com",
          has_password: false,
          invited_at: "2026-05-01T00:00:00.000Z",
          email_confirmed_at: null,
          confirmed_at: null,
          recovery_sent_at: "2026-05-01T01:00:00.000Z",
          last_sign_in_at: null,
          banned_until: null,
          deleted_at: null,
          identity_providers: ["email"],
        },
          ],
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return operatorQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Invite email" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Temporary password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute("href", "/admin/archived-users");
    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute(
      "title",
      "Restore archived users or permanently delete records from the user archive.",
    );
    expect(screen.getAllByText("Email unconfirmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invited").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No password").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Password email sent").length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith("get_admin_auth_user_status", { input_user_ids: ["user-1"] });
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
    const usageSessionsQuery = createAdminListQuery([
      {
        id: "usage-1",
        lease_id: "lease-1",
        desktop_session_id: "session-1",
        device_id: "MacBook",
        machine_code_hash: "machinehash123456",
        started_at: "2026-04-30T10:00:00.000Z",
        last_heartbeat_at: "2026-04-30T10:30:00.000Z",
        ended_at: "2026-04-30T10:45:00.000Z",
        end_reason: "released",
        heartbeat_count: 4,
      },
    ]);
    const usageEventsQuery = createAdminListQuery([
      {
        id: "usage-event-1",
        event_type: "activate_conflict",
        reason: "active_on_another_device",
        device_id: "Windows PC",
        machine_code_hash: "othermachine123456",
        occurred_at: "2026-04-30T10:20:00.000Z",
      },
      {
        id: "usage-event-2",
        event_type: "cooldown_waiting",
        reason: "cooldown_waiting",
        device_id: "Windows PC",
        machine_code_hash: "othermachine123456",
        occurred_at: "2026-04-30T10:25:00.000Z",
      },
    ]);
    const supportFeedbackQuery = createAdminListQuery([
      {
        id: "feedback-1",
        subject: "Need help with trial",
        status: "open",
        created_at: "2026-04-30T10:05:00.000Z",
      },
    ]);
    const emptyQuery = createAdminListQuery([]);
    const cooldownOverridesQuery = createAdminListQuery([]);
    const recentConflictEventsQuery = createAdminListQuery([
      {
        id: "usage-event-force-1",
        event_type: "activate_conflict",
        reason: "active_on_another_device",
        device_id: "Windows PC",
        machine_code_hash: "othermachine123456",
        occurred_at: "2026-04-30T10:20:00.000Z",
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
      if (table === "cloud_sync_usage_sessions") return usageSessionsQuery;
      if (table === "cloud_sync_usage_events") {
        return from.mock.calls.filter(([name]) => name === "cloud_sync_usage_events").length === 1 ? usageEventsQuery : recentConflictEventsQuery;
      }
      if (table === "cloud_sync_cooldown_overrides") return cooldownOverridesQuery;
      if (table === "support_feedback") return supportFeedbackQuery;
      if (table === "user_login_history") return emptyQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
    });

    render(element);

    expect(profileQuery.select).toHaveBeenCalledWith("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,is_admin,avatar_url,created_at");
    expect(screen.getByRole("heading", { name: "User operations" })).toBeInTheDocument();
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Donations" })).toBeInTheDocument();
    expect(screen.getByText("manual_ada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Certificates" })).toBeInTheDocument();
    expect(screen.getAllByText("GBAI-2026-D-000001").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Trials" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unbind machine" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Desktop sessions" })).toBeInTheDocument();
    expect(screen.getAllByText("MacBook").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Entitlements" })).toBeInTheDocument();
    expect(screen.getAllByText("cloud_sync").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Leases" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloud sync usage" })).toBeInTheDocument();
    expect(screen.getAllByText("45m").length).toBeGreaterThan(0);
    expect(screen.getByText("1 conflict attempts")).toBeInTheDocument();
    expect(screen.getByText("1 cooldown blocks")).toBeInTheDocument();
    expect(screen.getByText(/released/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant force switch" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("othermachine123456")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account timeline" })).toBeInTheDocument();
    expect(screen.getByText("Need help with trial")).toBeInTheDocument();
  });

  it("keeps user operations available when optional cloud sync detail tables are unavailable", async () => {
    const optionalCloudSyncTableError = {
      code: "42P01",
      message: "relation public.cloud_sync_usage_events does not exist",
    } as Error;
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
    const emptyQuery = createAdminListQuery([]);
    const missingOptionalCloudSyncQuery = createAdminListQuery(null, optionalCloudSyncTableError);
    const from = vi.fn((table: string) => {
      if (table === "profiles") return profileQuery;
      if (
        table === "cloud_sync_usage_sessions" ||
        table === "cloud_sync_usage_events" ||
        table === "cloud_sync_cooldown_overrides"
      ) {
        return missingOptionalCloudSyncQuery;
      }
      if (
        table === "donations" ||
        table === "certificates" ||
        table === "trial_code_redemptions" ||
        table === "desktop_sessions" ||
        table === "license_entitlements" ||
        table === "cloud_sync_leases" ||
        table === "support_feedback" ||
        table === "user_login_history"
      ) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    const element = await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
    });

    render(element);

    expect(screen.getByRole("heading", { name: "User operations" })).toBeInTheDocument();
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Cloud sync usage" })).toBeInTheDocument();
    expect(screen.getAllByText("0s").length).toBeGreaterThan(0);
  });

  it("renders admin users summary cards and search controls", async () => {
    const paginatedRpcResult = [
      {
        users: [
          {
            id: "user-1",
            email: "alice@example.com",
            display_name: "Alice",
            admin_role: "operator",
            account_status: "deleted",
            is_admin: false,
            avatar_url: null,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ],
        total_count: 1,
        filtered_count: 1,
      },
    ];
    const authStatusRpcResult = [
      {
        user_id: "user-1",
        email_confirmed_at: "2026-05-01T00:00:00.000Z",
        confirmed_at: null,
        invited_at: null,
        has_password: true,
        recovery_sent_at: null,
        last_sign_in_at: "2026-05-01T00:00:00.000Z",
      },
    ];
    const rpc = vi.fn((fnName: string) => {
      if (fnName === "get_admin_users_paginated") {
        return Promise.resolve({ data: paginatedRpcResult, error: null });
      }
      if (fnName === "get_admin_auth_user_status") {
        return Promise.resolve({ data: authStatusRpcResult, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    });
    const emptyQuery = createAdminListQuery([]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
      account_status: "active",
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? ownerQuery : ownerQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    render(await AdminUsersPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ query: "alice", status: "deleted" }),
    }));

    expect(screen.getByText("Total users")).toBeInTheDocument();
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    expect(screen.getByDisplayValue("alice")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select alice@example.com"));
    expect(screen.queryByRole("button", { name: "Bulk soft delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk soft delete selected users" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Manage user" })[0]).toHaveAttribute("href", "/admin/users/user-1");
    const moreActions = screen.getAllByRole("group", { name: "More actions" })[0];
    expect(moreActions).not.toHaveAttribute("open");
    expect(screen.getAllByRole("button", { name: "More actions" }).length).toBeGreaterThan(0);
    expect(moreActions).toContainElement(screen.getAllByRole("button", { name: "Soft delete" })[0]);
    expect(screen.queryByText("Detailed account, contributions, certificates, and devices")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-mobile-cards")).toHaveTextContent("alice@example.com");
  });

  it("shows an empty filtered state with reset action", async () => {
    const paginatedRpcResult = [
      {
        users: [],
        total_count: 1,
        filtered_count: 0,
      },
    ];
    const rpc = vi.fn((fnName: string) => {
      if (fnName === "get_admin_users_paginated") {
        return Promise.resolve({ data: paginatedRpcResult, error: null });
      }
      if (fnName === "get_admin_auth_user_status") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    });
    const emptyQuery = createAdminListQuery([]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
      account_status: "active",
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? ownerQuery : ownerQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    render(await AdminUsersPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ query: "nobody" }),
    }));

    expect(screen.getByText("No users match the current filters.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Reset" }).length).toBeGreaterThan(0);
  });

  it("renders the permanent delete danger zone on the admin user detail page", async () => {
    const profileQuery = createAdminListQuery({
      id: "user-1",
      email: "alice@example.com",
      display_name: "Alice",
      public_display_name: "Alice",
      public_supporter_enabled: true,
      admin_role: "user",
      account_status: "active",
      is_admin: false,
      created_at: "2026-05-01T00:00:00.000Z",
    });
    const emptyQuery = createAdminListQuery([]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
      account_status: "active",
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length <= 2 ? profileQuery : ownerQuery;
      }

      if (["donations", "certificates", "trial_code_redemptions", "desktop_sessions", "license_entitlements", "cloud_sync_leases", "cloud_sync_usage_sessions", "cloud_sync_usage_events", "cloud_sync_cooldown_overrides", "support_feedback", "user_login_history"].includes(table)) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permanent delete" })).toBeInTheDocument();
  });

  it("shows password recovery actions on the admin user detail page when the auth account has no password", async () => {
    const profileQuery = createAdminListQuery({
      id: "user-1",
      email: "invited@example.com",
      display_name: "Invited User",
      public_display_name: "Invited User",
      public_supporter_enabled: false,
      admin_role: "user",
      account_status: "active",
      is_admin: false,
      created_at: "2026-05-01T00:00:00.000Z",
    });
    const emptyQuery = createAdminListQuery([]);
    const operatorQuery = createAdminListQuery({
      admin_role: "operator",
      is_admin: false,
      account_status: "active",
    });
    const rpc = vi.fn(async () => ({
      data: [
        {
          user_id: "user-1",
          email: "invited@example.com",
          has_password: false,
          invited_at: "2026-05-01T00:00:00.000Z",
          email_confirmed_at: null,
          confirmed_at: null,
          recovery_sent_at: null,
          last_sign_in_at: null,
          banned_until: null,
          deleted_at: null,
          identity_providers: ["email"],
        },
      ],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? profileQuery : operatorQuery;
      }

      if (["donations", "certificates", "trial_code_redemptions", "desktop_sessions", "license_entitlements", "cloud_sync_leases", "cloud_sync_usage_sessions", "cloud_sync_usage_events", "cloud_sync_cooldown_overrides", "support_feedback", "user_login_history"].includes(table)) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "Password and invitation recovery" })).toBeInTheDocument();
    expect(screen.getByText("No password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send password setup email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set temporary password" })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("get_admin_auth_user_status", { input_user_ids: ["user-1"] });
  });

  it("hides the permanent delete danger zone from operators when viewing an owner account", async () => {
    const profileQuery = createAdminListQuery({
      id: "owner-1",
      email: "owner@example.com",
      display_name: "Owner",
      public_display_name: "Owner",
      public_supporter_enabled: true,
      admin_role: "owner",
      account_status: "active",
      is_admin: true,
      created_at: "2026-05-01T00:00:00.000Z",
    });
    const emptyQuery = createAdminListQuery([]);
    const operatorQuery = createAdminListQuery({
      admin_role: "operator",
      is_admin: false,
      account_status: "active",
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? profileQuery : operatorQuery;
      }

      if (["donations", "certificates", "trial_code_redemptions", "desktop_sessions", "license_entitlements", "cloud_sync_leases", "cloud_sync_usage_sessions", "cloud_sync_usage_events", "cloud_sync_cooldown_overrides", "support_feedback", "user_login_history"].includes(table)) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "operator-1" });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "owner-1", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.queryByText("Danger zone")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Permanent delete" })).not.toBeInTheDocument();
  });

  it("shows the permanent delete danger zone to operators when viewing an operator account", async () => {
    const profileQuery = createAdminListQuery({
      id: "operator-target",
      email: "target-operator@example.com",
      display_name: "Target Operator",
      public_display_name: "Target Operator",
      public_supporter_enabled: true,
      admin_role: "operator",
      account_status: "active",
      is_admin: false,
      created_at: "2026-05-01T00:00:00.000Z",
    });
    const emptyQuery = createAdminListQuery([]);
    const operatorQuery = createAdminListQuery({
      admin_role: "operator",
      is_admin: false,
      account_status: "active",
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? profileQuery : operatorQuery;
      }

      if (["donations", "certificates", "trial_code_redemptions", "desktop_sessions", "license_entitlements", "cloud_sync_leases", "cloud_sync_usage_sessions", "cloud_sync_usage_events", "cloud_sync_cooldown_overrides", "support_feedback", "user_login_history"].includes(table)) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "operator-1" });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "operator-target", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permanent delete" })).toBeInTheDocument();
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

    expect(requireAdminMock).toHaveBeenCalledWith("en", "/en/admin/audit-logs");
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
