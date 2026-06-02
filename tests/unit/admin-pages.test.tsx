import { fireEvent, render, screen, within } from "@testing-library/react";
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
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data, error })),
    lte: vi.fn(() => query),
    not: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ count: Array.isArray(data) ? data.length : 0, data, error })),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data, error })),
    then: (resolve: (value: { data: unknown; error: Error | null }) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve, reject),
  };

  return query;
}

function createDashboardQuery(data: unknown, error: Error | null = null) {
  const query = {
    gte: vi.fn(() => query),
    select: vi.fn(() => query),
    then: (resolve: (value: { data: unknown; error: Error | null }) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve, reject),
  };

  return query;
}

function createDashboardAdminClient() {
  const rows: Record<string, unknown[]> = {
    certificates: [{ issued_at: "2026-05-25T08:00:00.000Z", status: "active" }],
    cloud_sync_usage_events: [{ event_type: "activate_conflict", occurred_at: "2026-05-25T08:00:00.000Z" }],
    cloud_sync_usage_sessions: [{ started_at: "2026-05-25T08:00:00.000Z" }],
    donations: [
      { amount: 12000, created_at: "2026-05-25T08:00:00.000Z", paid_at: "2026-05-25T08:30:00.000Z", status: "paid" },
      { amount: 24000, created_at: "2026-04-25T08:00:00.000Z", paid_at: "2026-04-25T08:30:00.000Z", status: "paid" },
    ],
    license_entitlements: [{ status: "active", valid_until: "2026-07-01T00:00:00.000Z" }],
    operational_settings: [{ key: "payment_checkout", value: { is_paused: true } }],
    profiles: [
      { account_status: "active", created_at: "2026-05-25T08:00:00.000Z" },
      { account_status: "active", created_at: "2026-04-01T08:00:00.000Z" },
    ],
    software_releases: [
      {
        is_published: true,
        macos_arm64_primary_url: "https://example.com/m.dmg",
        macos_x64_primary_url: null,
        release_status: "ready",
        windows_primary_url: "https://example.com/w.exe",
      },
    ],
    support_feedback: [{ created_at: "2026-05-25T08:00:00.000Z", status: "open", updated_at: "2026-05-25T09:00:00.000Z" }],
    trial_code_redemptions: [{ redeemed_at: "2026-05-25T08:00:00.000Z", trial_valid_until: "2026-06-25T00:00:00.000Z" }],
    trial_codes: [{ deleted_at: null, ends_at: null, is_active: true, starts_at: null }],
    user_login_history: [{ logged_in_at: "2026-05-25T08:00:00.000Z", success: false }],
    webhook_logs: [{ created_at: "2026-05-25T08:00:00.000Z", status: "error" }],
  };

  return {
    from: vi.fn((table: string) => createDashboardQuery(rows[table] ?? [])),
  };
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
        title: "Operations dashboard",
        description: "Track support revenue, user growth, release health, and support workload from one admin view.",
        period7: "7 days",
        period30: "30 days",
        period90: "90 days",
        selectedPeriod: "{days}-day view",
        chartsTitle: "Trends",
        revenueTrendTitle: "Support revenue trend",
        userTrendTitle: "User growth trend",
        chartEmpty: "No activity in this period.",
        attentionTitle: "Needs attention",
        attentionEmptyTitle: "No urgent work",
        attentionEmptyDescription: "Core operating signals are clear for the selected period.",
        healthTitle: "Operating health",
        insightsTitle: "Recommended actions",
        quickLinksTitle: "Admin shortcuts",
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
        newUsersMetric: "New users",
        revenueMetric: "Support revenue",
        paidSupportMetric: "Paid support",
        certificatesIssuedMetric: "Certificates issued",
        activeEntitlementsMetric: "Active entitlements",
        activeTrialsMetric: "Active trials",
        pendingFeedbackMetric: "Open feedback",
        recentContributionsMetric: "Recent contributions",
        comparisonNew: "new activity",
        comparisonFlat: "no change",
        comparisonUp: "+{value} vs previous period",
        comparisonDown: "{value} vs previous period",
        health: {
          paymentCheckout: "Checkout",
          releaseHealth: "Release health",
          webhookErrors: "Webhook errors",
          loginFailures: "Login failures",
          cloudSyncConflicts: "Cloud sync conflicts",
          healthy: "Healthy",
          needsReview: "Review",
        },
        attention: {
          openFeedbackTitle: "Open feedback",
          openFeedbackDescription: "Support threads are waiting for review.",
          webhookErrorsTitle: "Webhook errors",
          webhookErrorsDescription: "Payment webhook logs include errors in this period.",
          releaseIssuesTitle: "Release issues",
          releaseIssuesDescription: "A published release is missing assets or has failed.",
          paymentPausedTitle: "Checkout paused",
          paymentPausedDescription: "Payment checkout is currently paused.",
        },
        insights: {
          paymentPausedTitle: "Resume checkout when the incident is clear",
          paymentPausedDescription: "Marketing campaigns should wait until checkout is available again.",
          revenueDropTitle: "Investigate support revenue drop",
          revenueDropDescription: "Compare traffic, release cadence, and support tier messaging before the next campaign.",
          feedbackBacklogTitle: "Reduce support backlog",
          feedbackBacklogDescription: "Open feedback is high enough to affect trust and conversion.",
          webhookErrorsTitle: "Review payment webhook errors",
          webhookErrorsDescription: "Payment reliability issues can hide successful support transactions.",
          loginFailuresTitle: "Review authentication friction",
          loginFailuresDescription: "Login failures may indicate account confusion or abuse.",
          releaseHealthTitle: "Complete release delivery",
          releaseHealthDescription: "Marketing should link only to releases with complete assets.",
          cloudSyncConflictsTitle: "Watch cloud sync conflicts",
          cloudSyncConflictsDescription: "Frequent conflicts can create support load for paid users.",
          steadyTitle: "Operating signals look steady",
          steadyDescription: "Use the quiet window to prepare the next content or support campaign.",
        },
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
        managementSummary: "{shown} of {total} feedback threads shown",
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
        tabs: {
          access: "Access and devices",
          batches: "Batches",
          codes: "License codes",
          diagnostics: "Security and sync diagnostics",
          redemptions: "Redemptions",
        },
        cloudSyncCooldownTitle: "Cloud sync device switch cooldown",
        cloudSyncCooldownDescription: "Set how long a newly logged-in device must wait after another device releases cloud sync.",
        cloudSyncUsageSignalsTitle: "Cloud sync usage signals",
        cloudSyncUsageSignalsDescription: "Use these signals to diagnose device switching, occupied sync sessions, cooldown blocks, and successful activation.",
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
        issueCodes: "Issue codes",
        findMaintainCodes: "Find and maintain codes",
        redemptionHealth: "Redemption health",
        usageAccess: "Usage and access",
        batchGenerateTitle: "Batch generate license codes",
        batchGenerateDescription: "Generate trial, monthly, quarterly, or yearly license codes.",
        generateBatch: "Generate codes",
        batchesTitle: "License batches",
        licenseCodesTitle: "License codes",
        managementSummary: "{shown} of {total} codes shown",
        editCode: "Edit code",
        updateCode: "Update code",
        deleteCode: "Delete code",
        deleteCodeConfirm: "Delete this license code?",
        confirmDeleteHelp: "Click again to confirm this action.",
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
        sortBy: "Sort by",
        sortOrder: "Sort order",
        ascending: "Ascending",
        descending: "Descending",
        pageSize: "Rows per page",
        applyMetadata: "Apply channel",
        clearSelection: "Clear selection",
        bulkDeleteConfirm: "Delete selected license codes?",
        selectedCount: "{count} selected",
        selectAll: "Select all license codes",
        securitySignalsTitle: "Security signals",
        securitySignalsDescription: "Review recent license code redemption failures, blocks, and suspicious IP activity.",
        failedAttempts: "Failed attempts",
        blockedAttempts: "Blocked attempts",
        topRiskIp: "Top risk IP",
        rawEvent: "Raw event",
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
        close: "Close",
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
        missingTitle: "User record unavailable",
        missingDescription: "The user record {id} is no longer available in the active account table.",
        missingHelp: "The account may have been deleted, archived, or removed after the users list was loaded.",
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
        authOAuthOnly: "OAuth sign-in",
        authEmailPasswordNotSet: "Email password not set",
        authGoogleProvider: "Google",
        authGithubProvider: "GitHub",
        authEmailProvider: "Email",
        authRecoverySent: "Password email sent",
        authLastSignIn: "Last sign-in",
        passwordRecoveryTitle: "Password and invitation recovery",
        passwordRecoveryDescription: "This account needs a password before it can use email sign-in.",
        passwordRecoveryOAuthDescription: "This account can sign in with OAuth. Send a setup email only if the user also wants email and password sign-in.",
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
        supportCertificates: "Development support and certificates",
        supportCertificateRecord: "Record",
        supportCertificatePaymentStatus: "Payment status",
        supportCertificateAmount: "Amount",
        supportCertificateReference: "Payment / source",
        supportCertificateNumber: "Certificate number",
        supportCertificateType: "Certificate type",
        supportCertificateStatus: "Certificate status",
        supportCertificateTime: "Time",
        supportCertificateAction: "Action",
        supportCertificateMissing: "Certificate not generated",
        supportCertificateHonorRecord: "Honor certificate",
        supportCertificateHonorSource: "Cumulative support",
        supportCertificateEmpty: "No support or certificate records",
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
        managementSummary: "{shown} of {total} users shown",
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
        bulkChangeType: "Bulk change type",
        bulkSoftDelete: "Bulk soft delete",
        bulkSoftDeleteSelected: "Bulk soft delete selected users",
        bulkArchiveDelete: "Bulk archive delete",
        bulkArchiveDeleteSelected: "Bulk archive delete selected users",
        changeStatusToActive: "Enable account",
        changeStatusToDeleted: "Mark deleted",
        changeStatusToDisabled: "Disable account",
        clearSelection: "Clear selection",
        bulkEnableConfirm: "Confirm enabling {n} users?",
        bulkDisableConfirm: "Confirm disabling {n} users?",
        bulkRoleConfirm: "Confirm changing role for {n} users?",
        roleTarget: "Target role",
        typeTarget: "Target type",
        summaryTotal: "Total users",
        summaryActive: "Active users",
        summaryDisabled: "Disabled users",
        summaryElevated: "Elevated users",
        actions: "Actions",
        type: "Type",
        devicesAndTrials: "Devices / trials",
        createdAt: "Created",
        accountType: "Account type",
        standardType: "Standard",
        aiTestType: "AI test",
        accountTypeUpdated: "Account type updated.",
        accountTypeUpdateFailed: "Unable to update account type.",
        bulkUserAccountTypeUpdated: "Updated account type for the selected users.",
        bulkUserAccountTypeUpdateFailed: "Unable to update account type for the selected users.",
        adminType: "Admin",
        empty: "No users yet.",
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
        navGroups: {
          content: "Content",
          operations: "Operations",
          overview: "Overview",
          trust: "Trust & Support",
        },
      },
    },
  },
  "zh-Hant": {
    admin: {
      common: {
        processing: "處理中...",
        saving: "儲存中...",
      },
      pagination: {
        previous: "上一頁",
        next: "下一頁",
        page: "第",
        of: "頁，共",
      },
      overview: {
        eyebrow: "管理工具",
        title: "營運數據看板",
        description: "集中追蹤支持收入、使用者成長、版本健康與支援負載。",
        period7: "7 天",
        period30: "30 天",
        period90: "90 天",
        selectedPeriod: "{days} 天視圖",
        chartsTitle: "趨勢",
        revenueTrendTitle: "支持收入趨勢",
        userTrendTitle: "使用者成長趨勢",
        chartEmpty: "此週期尚無活動。",
        attentionTitle: "需要關注",
        attentionEmptyTitle: "暫無緊急事項",
        attentionEmptyDescription: "所選週期內核心營運訊號穩定。",
        healthTitle: "運行健康",
        insightsTitle: "建議行動",
        quickLinksTitle: "管理捷徑",
        donationsTitle: "支持",
        donationsDescription: "檢視支持記錄、狀態與交易 ID。",
        certificatesTitle: "證書",
        certificatesDescription: "檢視已頒發的證書編號、類型、狀態與頒發日期。",
        releasesTitle: "版本發布",
        releasesDescription: "上傳安裝包並管理版本。",
        notificationsTitle: "通知",
        notificationsDescription: "發布與下架站內通知。",
        newsTitle: "新聞",
        newsDescription: "建立、編輯、發布與下架 AI 生成新聞文章。",
        supportFeedbackTitle: "回饋",
        supportFeedbackDescription: "檢視帳號問題與支援請求。",
        contributionPricingTitle: "支持價格設定",
        contributionPricingDescription: "管理 Contributions 頁面的價格、折扣與開發支持方案文案。",
        supportSettingsTitle: "支援設定",
        supportSettingsDescription: "管理公開支援聯絡渠道。",
        policyPagesTitle: "Policy pages",
        policyPagesDescription: "Edit the English Terms, Privacy, and Refund pages linked from the footer.",
        licensesTitle: "兌換",
        licensesDescription: "建立試用兌換碼、檢視權益，並撤銷桌面雲端同步存取。",
        usersTitle: "使用者",
        usersDescription: "檢視帳號角色、狀態、試用綁定與桌面裝置。",
        registrationSecurityTitle: "註冊安全",
        registrationSecurityDescription: "檢視註冊濫用訊號並封鎖可疑來源。",
        auditLogsTitle: "稽核紀錄",
        auditLogsDescription: "檢視管理員修正、撤銷與原因。",
        metricsTitle: "營運概覽",
        totalUsersMetric: "使用者總數",
        newUsersMetric: "新增使用者",
        revenueMetric: "支持收入",
        paidSupportMetric: "已付款支持",
        certificatesIssuedMetric: "已簽發證書",
        activeEntitlementsMetric: "有效權益",
        activeTrialsMetric: "啟用中的試用碼",
        pendingFeedbackMetric: "待處理回饋",
        recentContributionsMetric: "近期支持",
        comparisonNew: "新增活動",
        comparisonFlat: "無變化",
        comparisonUp: "較上一週期 +{value}",
        comparisonDown: "較上一週期 {value}",
        health: {
          paymentCheckout: "付款結帳",
          releaseHealth: "版本健康",
          webhookErrors: "Webhook 錯誤",
          loginFailures: "登入失敗",
          cloudSyncConflicts: "雲端同步衝突",
          healthy: "正常",
          needsReview: "需檢查",
        },
        attention: {
          openFeedbackTitle: "待處理回饋",
          openFeedbackDescription: "支援對話正在等待處理。",
          webhookErrorsTitle: "Webhook 錯誤",
          webhookErrorsDescription: "此週期付款 webhook 紀錄出現錯誤。",
          releaseIssuesTitle: "版本問題",
          releaseIssuesDescription: "已發布版本缺少檔案或狀態失敗。",
          paymentPausedTitle: "結帳已暫停",
          paymentPausedDescription: "付款結帳目前處於暫停狀態。",
        },
        insights: {
          paymentPausedTitle: "排除事件後恢復結帳",
          paymentPausedDescription: "行銷活動應等結帳恢復後再推進。",
          revenueDropTitle: "檢查支持收入下滑",
          revenueDropDescription: "下次活動前對照流量、版本節奏與支持方案文案。",
          feedbackBacklogTitle: "降低支援積壓",
          feedbackBacklogDescription: "待處理回饋偏高，可能影響信任與轉化。",
          webhookErrorsTitle: "檢查付款 webhook 錯誤",
          webhookErrorsDescription: "付款可靠性問題可能掩蓋成功支持交易。",
          loginFailuresTitle: "檢查登入摩擦",
          loginFailuresDescription: "登入失敗可能代表帳號困惑或濫用。",
          releaseHealthTitle: "補齊版本交付",
          releaseHealthDescription: "行銷連結應只指向檔案完整的版本。",
          cloudSyncConflictsTitle: "關注雲端同步衝突",
          cloudSyncConflictsDescription: "高頻衝突會增加付費使用者的支援負載。",
          steadyTitle: "營運訊號穩定",
          steadyDescription: "可利用空檔準備下一輪內容或支持活動。",
        },
      },
      donations: {
        eyebrow: "管理後台",
        title: "管理支持記錄",
        description: "檢視付款記錄，並新增已驗證的人工支持。",
        provider: "服務商",
        status: "狀態",
        amount: "金額",
        paidAt: "付款時間（UTC）",
        transactionId: "交易 ID",
        manualEntryTitle: "人工已付款支持記錄",
        manualEntryDescription: "為既有使用者以電子郵件或使用者 ID 建立一筆已付款人工記錄。",
        userIdentifier: "電子郵件或使用者 ID",
        amountCents: "金額（美分）",
        reference: "參考編號",
        reason: "原因",
        submitManualDonation: "新增人工支持記錄",
        empty: "尚無支持記錄。",
        providers: {
          stripe: "舊版 Stripe",
          paypal: "PayPal",
          manual: "人工登錄",
          dodo: "Dodo Payments",
        },
        statuses: {
          pending: "待處理",
          paid: "已付款",
          cancelled: "已取消",
          failed: "失敗",
          refunded: "已退款",
        },
        filter: {
          search: "搜尋",
          searchPlaceholder: "依交易 ID 搜尋",
          provider: "服務商",
          allProviders: "所有服務商",
          status: "狀態",
          allStatuses: "所有狀態",
          dateFrom: "日期從",
          dateTo: "日期到",
          moreFilters: "更多篩選",
          apply: "套用篩選",
          reset: "重設",
        },
        export: "Export CSV",
        exporting: "Exporting...",
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
        filter: {
          search: "搜尋",
          searchPlaceholder: "依證書編號搜尋",
          type: "證書類型",
          allTypes: "所有類型",
          status: "狀態",
          allStatuses: "所有狀態",
          issuedFrom: "頒發日期從",
          issuedTo: "頒發日期到",
          moreFilters: "更多篩選",
          apply: "套用篩選",
          reset: "重設",
        },
        export: "Export CSV",
        exporting: "Exporting...",
        selectAll: "Select all",
        selectedCount: "{count} selected",
        exportSelected: "Export selected",
        clearSelection: "Clear selection",
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
        contributionPricing: "支持價格設定",
        dashboard: "總覽",
        donations: "支持",
        language: "語言",
        licenses: "兌換",
        menu: "選單",
        news: "新聞",
        notifications: "通知",
        policies: "Policy pages",
        registrationSecurity: "註冊安全",
        releases: "版本發布",
        returnToSite: "返回網站",
        signOut: "登出",
        supportFeedback: "回饋",
        supportSettings: "支援設定",
        users: "使用者",
        navGroups: {
          content: "內容",
          operations: "營運",
          overview: "總覽",
          trust: "信任與支援",
        },
      },
    },
  },
  ja: {
    admin: {
      common: {
        processing: "Processing...",
        saving: "Saving...",
      },
      pagination: {
        previous: "前へ",
        next: "次へ",
        page: "ページ",
        of: "／全",
      },
      overview: {
        eyebrow: "管理ツール",
        title: "管理画面",
        description: "応援記録、証明書、リリース、ライセンス、ユーザー、監査履歴を管理します。",
        donationsTitle: "応援",
        donationsDescription: "応援記録、ステータス、取引 ID を確認します。",
        certificatesTitle: "証明書",
        certificatesDescription: "発行済み証明書の番号、種類、ステータス、発行日を確認します。",
        releasesTitle: "リリース",
        releasesDescription: "インストーラーとリリースを管理します。",
        notificationsTitle: "通知",
        notificationsDescription: "アプリ内通知を公開・非公開にします。",
        newsTitle: "ニュース",
        newsDescription: "AI 生成ニュース記事の作成、編集、公開、非公開を管理します。",
        supportFeedbackTitle: "フィードバック",
        supportFeedbackDescription: "アカウント問題とサポート依頼を確認します。",
        contributionPricingTitle: "応援価格設定",
        contributionPricingDescription: "Contributions ページの価格、割引、開発サポート文言を管理します。",
        supportSettingsTitle: "サポート設定",
        supportSettingsDescription: "公開サポート連絡先を管理します。",
        policyPagesTitle: "Policy pages",
        policyPagesDescription: "Edit the English Terms, Privacy, and Refund pages linked from the footer.",
        licensesTitle: "ライセンス",
        licensesDescription: "試用コード、権限、デスクトップのクラウド同期アクセスを管理します。",
        usersTitle: "ユーザー",
        usersDescription: "アカウント権限、状態、トライアル紐付け、デスクトップ端末を確認します。",
        registrationSecurityTitle: "登録セキュリティ",
        registrationSecurityDescription: "登録の不正利用シグナルを確認し、不審な送信元をブロックします。",
        auditLogsTitle: "監査ログ",
        auditLogsDescription: "管理者の修正、取り消し、理由を確認します。",
        metricsTitle: "運用概要",
        totalUsersMetric: "総ユーザー数",
        activeTrialsMetric: "有効な試用コード",
        pendingFeedbackMetric: "未対応フィードバック",
        recentContributionsMetric: "最近の応援",
      },
      donations: {
        eyebrow: "管理画面",
        title: "管理者向け応援記録",
        description: "決済記録を確認し、検証済みの手動応援記録を追加します。",
        provider: "プロバイダー",
        status: "ステータス",
        amount: "金額",
        paidAt: "支払い日時（UTC）",
        transactionId: "取引 ID",
        manualEntryTitle: "手動支払い済み応援記録",
        manualEntryDescription: "既存ユーザーのメールまたはユーザー ID で支払い済み手動記録を 1 件作成します。",
        userIdentifier: "メールまたはユーザー ID",
        amountCents: "金額（セント）",
        reference: "参照番号",
        reason: "理由",
        submitManualDonation: "手動応援記録を追加",
        empty: "応援記録はまだありません。",
        providers: {
          stripe: "旧 Stripe",
          paypal: "PayPal",
          manual: "手動",
          dodo: "Dodo Payments",
        },
        statuses: {
          pending: "保留中",
          paid: "支払い済み",
          cancelled: "キャンセル済み",
          failed: "失敗",
          refunded: "返金済み",
        },
        filter: {
          search: "検索",
          searchPlaceholder: "取引 ID で検索",
          provider: "プロバイダー",
          allProviders: "すべてのプロバイダー",
          status: "ステータス",
          allStatuses: "すべてのステータス",
          dateFrom: "開始日",
          dateTo: "終了日",
          moreFilters: "詳細フィルター",
          apply: "適用",
          reset: "リセット",
        },
        export: "Export CSV",
        exporting: "Exporting...",
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
        filter: {
          search: "検索",
          searchPlaceholder: "証明書番号で検索",
          type: "証明書種類",
          allTypes: "すべての種類",
          status: "ステータス",
          allStatuses: "すべてのステータス",
          issuedFrom: "発行日（開始）",
          issuedTo: "発行日（終了）",
          moreFilters: "詳細フィルター",
          apply: "適用",
          reset: "リセット",
        },
        export: "Export CSV",
        exporting: "Exporting...",
        selectAll: "Select all",
        selectedCount: "{count} selected",
        exportSelected: "Export selected",
        clearSelection: "Clear selection",
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
        contributionPricing: "応援価格設定",
        dashboard: "概要",
        donations: "応援",
        language: "言語",
        licenses: "ライセンス",
        menu: "メニュー",
        news: "ニュース",
        notifications: "通知",
        policies: "Policy pages",
        registrationSecurity: "登録セキュリティ",
        releases: "リリース",
        returnToSite: "サイトへ戻る",
        signOut: "サインアウト",
        supportFeedback: "フィードバック",
        supportSettings: "サポート設定",
        users: "ユーザー",
        navGroups: {
          content: "コンテンツ",
          operations: "運用",
          overview: "概要",
          trust: "信頼とサポート",
        },
      },
    },
  },
  ko: {
    admin: {
      common: {
        processing: "Processing...",
        saving: "Saving...",
      },
      pagination: {
        previous: "이전",
        next: "다음",
        page: "페이지",
        of: "/ 전체",
      },
      overview: {
        eyebrow: "관리 도구",
        title: "관리",
        description: "후원 기록, 인증서, 릴리스, 라이선스, 사용자, 감사 활동을 관리합니다.",
        donationsTitle: "지원",
        donationsDescription: "후원 기록, 상태, 거래 ID를 확인합니다.",
        certificatesTitle: "인증서",
        certificatesDescription: "발급된 인증서 번호, 유형, 상태, 발급일을 확인합니다.",
        releasesTitle: "릴리스",
        releasesDescription: "설치 파일과 릴리스를 관리합니다.",
        notificationsTitle: "알림",
        notificationsDescription: "앱 내 공지를 게시하거나 내립니다.",
        newsTitle: "뉴스",
        newsDescription: "AI 생성 뉴스 글을 만들고, 편집하고, 게시하거나 게시 해제합니다.",
        supportFeedbackTitle: "피드백",
        supportFeedbackDescription: "계정 문제와 지원 요청을 확인합니다.",
        contributionPricingTitle: "지원 가격 설정",
        contributionPricingDescription: "Contributions 페이지의 가격, 할인, 개발 지원 문구를 관리합니다.",
        supportSettingsTitle: "지원 설정",
        supportSettingsDescription: "공개 지원 연락 채널을 관리합니다.",
        policyPagesTitle: "Policy pages",
        policyPagesDescription: "Edit the English Terms, Privacy, and Refund pages linked from the footer.",
        licensesTitle: "라이선스",
        licensesDescription: "체험 코드, 권한, 데스크톱 클라우드 동기화 접속을 관리합니다.",
        usersTitle: "사용자",
        usersDescription: "계정 역할, 상태, 체험 연결, 데스크톱 기기를 확인합니다.",
        registrationSecurityTitle: "등록 보안",
        registrationSecurityDescription: "가입 남용 신호를 확인하고 의심스러운 출처를 차단합니다.",
        auditLogsTitle: "감사 로그",
        auditLogsDescription: "관리자 수정, 폐기, 사유를 확인합니다.",
        metricsTitle: "운영 개요",
        totalUsersMetric: "전체 사용자",
        activeTrialsMetric: "활성 체험 코드",
        pendingFeedbackMetric: "미처리 피드백",
        recentContributionsMetric: "최근 지원",
      },
      donations: {
        eyebrow: "관리",
        title: "관리자 후원 기록",
        description: "결제 기록을 확인하고 검증된 수동 후원 기록을 추가합니다.",
        provider: "제공업체",
        status: "상태",
        amount: "금액",
        paidAt: "결제 시간(UTC)",
        transactionId: "거래 ID",
        manualEntryTitle: "수동 결제 완료 후원 기록",
        manualEntryDescription: "기존 사용자의 이메일 또는 사용자 ID로 결제 완료 수동 기록을 하나 만듭니다.",
        userIdentifier: "이메일 또는 사용자 ID",
        amountCents: "금액(센트)",
        reference: "참조 번호",
        reason: "사유",
        submitManualDonation: "수동 후원 추가",
        empty: "후원 기록이 없습니다.",
        providers: {
          stripe: "이전 Stripe",
          paypal: "PayPal",
          manual: "수동",
          dodo: "Dodo Payments",
        },
        statuses: {
          pending: "대기 중",
          paid: "결제 완료",
          cancelled: "취소됨",
          failed: "실패",
          refunded: "환불됨",
        },
        filter: {
          search: "검색",
          searchPlaceholder: "거래 ID로 검색",
          provider: "제공업체",
          allProviders: "모든 제공업체",
          status: "상태",
          allStatuses: "모든 상태",
          dateFrom: "시작일",
          dateTo: "종료일",
          moreFilters: "더 많은 필터",
          apply: "적용",
          reset: "재설정",
        },
        export: "Export CSV",
        exporting: "Exporting...",
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
        filter: {
          search: "검색",
          searchPlaceholder: "인증서 번호로 검색",
          type: "인증서 유형",
          allTypes: "모든 유형",
          status: "상태",
          allStatuses: "모든 상태",
          issuedFrom: "발급일(시작)",
          issuedTo: "발급일(종료)",
          moreFilters: "더 많은 필터",
          apply: "적용",
          reset: "재설정",
        },
        export: "Export CSV",
        exporting: "Exporting...",
        selectAll: "Select all",
        selectedCount: "{count} selected",
        exportSelected: "Export selected",
        clearSelection: "Clear selection",
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
        contributionPricing: "지원 가격 설정",
        dashboard: "개요",
        donations: "후원",
        language: "언어",
        licenses: "라이선스",
        menu: "메뉴",
        news: "뉴스",
        notifications: "알림",
        policies: "Policy pages",
        registrationSecurity: "등록 보안",
        releases: "릴리스",
        returnToSite: "사이트로 돌아가기",
        signOut: "로그아웃",
        supportFeedback: "피드백",
        supportSettings: "지원 설정",
        users: "사용자",
        navGroups: {
          content: "콘텐츠",
          operations: "운영",
          overview: "개요",
          trust: "신뢰 및 지원",
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
    createSupabaseAdminClientMock.mockReset();
  });

  it("renders the guarded admin overview with admin tool links", async () => {
    createSupabaseAdminClientMock.mockReturnValue(createDashboardAdminClient());

    const element = await AdminPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ period: "7d" }),
    });

    const { container } = render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en", "/en/admin");
    expect(screen.getByRole("heading", { name: "Operations dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "7 days" })).toHaveAttribute("href", "/admin?period=7d");
    expect(screen.getByRole("link", { name: "30 days" })).toHaveAttribute("href", "/admin?period=30d");
    expect(screen.getByRole("link", { name: "90 days" })).toHaveAttribute("href", "/admin?period=90d");
    expect(screen.getAllByRole("link", { name: /donations/i }).some((link) => link.getAttribute("href") === "/admin/donations")).toBe(true);
    expect(container.querySelector('a[href="/admin/certificates"]')).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /releases/i }).some((link) => link.getAttribute("href") === "/admin/releases")).toBe(true);
    expect(screen.getAllByRole("link", { name: /news/i }).some((link) => link.getAttribute("href") === "/admin/news")).toBe(true);
    expect(screen.getAllByRole("link", { name: /registration security/i }).some((link) => link.getAttribute("href") === "/admin/registration-security")).toBe(true);
    expect(screen.getAllByRole("link", { name: /audit logs/i }).some((link) => link.getAttribute("href") === "/admin/audit-logs")).toBe(true);
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
    expect(createSupabaseAdminClientMock).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Operations overview" })).toBeInTheDocument();
    expect(screen.getByText("Total users")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("Support revenue")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getAllByText("Open feedback").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Trends" })).toBeInTheDocument();
    expect(screen.getByText("Support revenue trend")).toBeInTheDocument();
    expect(screen.getByText("User growth trend")).toBeInTheDocument();
    expect(screen.getAllByText("No activity in this period.").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("Checkout paused")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operating health" })).toBeInTheDocument();
    expect(screen.getAllByText("Webhook errors").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Recommended actions" })).toBeInTheDocument();
    expect(screen.getByText("Resume checkout when the incident is clear")).toBeInTheDocument();
  });

  it("renders localized admin overview copy beyond English", async () => {
    createSupabaseAdminClientMock.mockReturnValue(createDashboardAdminClient());
    const element = await AdminPage({ params: Promise.resolve({ locale: "zh-Hant" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh-Hant", "/zh-Hant/admin");
    expect(screen.getByText("管理工具")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "營運數據看板" })).toBeInTheDocument();
    expect(screen.getByText("支持收入")).toBeInTheDocument();
    expect(screen.getByText("建議行動")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /支持/ }).some((link) => link.getAttribute("href") === "/admin/donations")).toBe(true);
    expect(screen.getAllByRole("link", { name: /版本發布/ }).some((link) => link.getAttribute("href") === "/admin/releases")).toBe(true);
    expect(screen.getAllByRole("link", { name: /稽核紀錄/ }).some((link) => link.getAttribute("href") === "/admin/audit-logs")).toBe(true);
    expect(screen.getByText("檢視支持記錄、狀態與交易 ID。")).toBeInTheDocument();
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

    const element = await AdminDonationsPage({ params: Promise.resolve({ locale: "zh-Hant" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("zh-Hant", "/zh-Hant/admin/donations");
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("donations");
    expect(donationsQuery.select).toHaveBeenCalledWith("id,provider,status,amount,currency,provider_transaction_id,paid_at,created_at");
    expect(donationsQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "管理支持記錄" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "人工已付款支持記錄" })).toBeInTheDocument();
    expect(screen.getByLabelText("電子郵件或使用者 ID")).toBeRequired();
    expect(screen.getByLabelText("原因")).toBeRequired();
    expect(screen.getByRole("button", { name: "新增人工支持記錄" })).toBeInTheDocument();
    expect(screen.getAllByText("舊版 Stripe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("人工登錄").length).toBeGreaterThan(0);
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

    expect(requireAdminMock).toHaveBeenCalledWith("ja", "/ja/admin/donations");
    expect(screen.getByRole("heading", { name: "管理者向け応援記録" })).toBeInTheDocument();
    expect(screen.getAllByText("PayPal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("キャンセル済み").length).toBeGreaterThan(0);
    expect(screen.queryByText("paypal")).not.toBeInTheDocument();
    expect(screen.queryByText("cancelled")).not.toBeInTheDocument();
    expect(screen.getAllByText("$35.00 USD").length).toBeGreaterThan(0);
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

    const element = await AdminCertificatesPage({ params: Promise.resolve({ locale: "ko" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("ko", "/ko/admin/certificates");
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

    expect(requireAdminMock).toHaveBeenCalledWith("ja", "/ja/admin/certificates");
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
    expect(codesQuery.select).toHaveBeenCalledWith("id,batch_id,label,trial_days,duration_kind,channel_type,channel_note,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by,created_by", { count: "exact" });
    expect(codesQuery.range).toHaveBeenCalledWith(0, 49);
    expect(screen.getByRole("heading", { name: "License management" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Batch generate license codes" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Batch name").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Channel note")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Trial days")[0]).toHaveAttribute("max", "7");
    expect(screen.getByText("Monthly codes use a fixed 30-day duration. Quarterly uses 90 days; yearly uses 365 days.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate codes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Batches" })).toHaveAttribute("href", "/admin/licenses?tab=batches");
    expect(screen.getByRole("link", { name: "Security and sync diagnostics" })).toHaveAttribute("href", "/admin/licenses?tab=diagnostics");
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("203.0.113.10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Taobao May monthly").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1MAB-****-****-MNOP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 of 1 codes shown").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select all license codes" })).toBeInTheDocument();

    const licenseCodesTable = screen.getByRole("table", { name: "License codes" });
    expect(licenseCodesTable).toHaveClass("min-w-[1560px]", "table-fixed");
    expect(screen.getAllByRole("table", { name: "License codes" })).toHaveLength(1);
    expect(screen.getAllByTestId("admin-table-shell")[0]).toHaveClass("overflow-x-auto", "overscroll-x-contain");
    expect(screen.getAllByRole("columnheader", { name: "Action" }).some((header) => header.className.includes("sticky") && header.className.includes("right-0"))).toBe(true);
    expect(screen.getAllByText("Issue codes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Find and maintain codes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Redemption health").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usage and access").length).toBeGreaterThan(0);
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

  it("renders user roles as read-only on the users page for owner admins while keeping bulk role changes", async () => {
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
    const loginHistoryQuery = createAdminListQuery([
      {
        user_id: "user-1",
        logged_in_at: "2026-05-01T02:00:00.000Z",
      },
    ]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? ownerQuery : ownerQuery;
      }

      if (table === "user_login_history") return loginHistoryQuery;
      if (table === "trial_code_redemptions" || table === "desktop_sessions") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    const { container } = render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getAllByText("Standard user").length).toBeGreaterThan(0);
    expect(container.querySelector('td select[name="admin_role"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save role" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Target role" })).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Select ada@example.com"));
    expect(await screen.findAllByRole("combobox", { name: "Target role" })).toHaveLength(2);
    expect(await screen.findByRole("button", { name: "Bulk change role" })).toBeInTheDocument();
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

      if (table === "trial_code_redemptions" || table === "desktop_sessions" || table === "user_login_history") return emptyQuery;

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

      if (table === "trial_code_redemptions" || table === "desktop_sessions" || table === "user_login_history") return emptyQuery;

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

  it("labels OAuth users without a password as OAuth sign-in instead of a broken password account", async () => {
    const users = [
      {
        id: "user-1",
        email: "oauth@example.com",
        display_name: "OAuth User",
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
          data: [{ users, total_count: 1, filtered_count: 1 }],
          error: null,
        });
      }

      if (fnName === "get_admin_auth_user_status") {
        return Promise.resolve({
          data: [
            {
              user_id: "user-1",
              email: "oauth@example.com",
              has_password: false,
              invited_at: null,
              email_confirmed_at: "2026-05-01T00:00:00.000Z",
              confirmed_at: "2026-05-01T00:00:00.000Z",
              recovery_sent_at: null,
              last_sign_in_at: "2026-05-01T01:00:00.000Z",
              banned_until: null,
              deleted_at: null,
              identity_providers: ["google", "github"],
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${fnName}` } });
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") return operatorQuery;
      if (table === "trial_code_redemptions" || table === "desktop_sessions" || table === "user_login_history") return emptyQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUsersPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getAllByText("OAuth sign-in").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Email password not set").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Google").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
    expect(screen.queryByText("No password")).not.toBeInTheDocument();
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
        donation_id: "donation-1",
        type: "donation",
        status: "active",
        issued_at: "2026-04-30T10:00:01.000Z",
      },
      {
        id: "certificate-2",
        certificate_number: "GBAI-2026-H-000002",
        donation_id: null,
        type: "honor",
        status: "active",
        issued_at: "2026-05-01T10:00:01.000Z",
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

    const { container } = render(element);

    expect(profileQuery.select).toHaveBeenCalledWith("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,account_type,is_admin,avatar_url,created_at");
    expect(certificatesQuery.select).toHaveBeenCalledWith("id,certificate_number,donation_id,type,status,issued_at");
    expect(screen.getByRole("heading", { name: "User operations" })).toBeInTheDocument();
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Development support and certificates" })).toBeInTheDocument();
    expect(container.querySelector('table[aria-label="Development support and certificates"]')).toBeInTheDocument();
    expect(screen.getByText("Record")).toBeInTheDocument();
    expect(screen.getByText("Payment / source")).toBeInTheDocument();
    expect(screen.getByText("Certificate number")).toBeInTheDocument();
    expect(screen.getByText("manual_ada")).toBeInTheDocument();
    expect(screen.getAllByText("GBAI-2026-D-000001").length).toBeGreaterThan(0);
    expect(screen.getByText("Honor certificate")).toBeInTheDocument();
    expect(screen.getByText("Cumulative support")).toBeInTheDocument();
    expect(screen.getAllByText("GBAI-2026-H-000002").length).toBeGreaterThan(0);
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
    expect(screen.getByRole("link", { name: "Need help with trial" })).toHaveAttribute("href", "/en/admin/support-feedback/feedback-1");
  });

  it("surfaces user detail profile query errors instead of masking them as a missing user", async () => {
    const profileQuery = createAdminListQuery(null, { code: "PGRST204", message: "Could not find the account_type column" } as Error);
    const emptyQuery = createAdminListQuery([]);
    const from = vi.fn((table: string) => {
      if (table === "profiles") return profileQuery;
      if (
        table === "donations" ||
        table === "certificates" ||
        table === "trial_code_redemptions" ||
        table === "desktop_sessions" ||
        table === "license_entitlements" ||
        table === "cloud_sync_leases" ||
        table === "cloud_sync_usage_sessions" ||
        table === "cloud_sync_usage_events" ||
        table === "cloud_sync_cooldown_overrides" ||
        table === "support_feedback" ||
        table === "user_login_history"
      ) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    await expect(AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
    })).rejects.toMatchObject({
      code: "PGRST204",
    });
  });

  it("opens user detail when production has not applied the account type profile column migration yet", async () => {
    const missingAccountTypeQuery = createAdminListQuery(null, {
      code: "PGRST204",
      message: "Could not find the 'account_type' column of 'profiles' in the schema cache",
    } as Error);
    const legacyProfileQuery = createAdminListQuery({
      id: "user-1",
      email: "legacy@example.com",
      display_name: "Legacy User",
      public_display_name: "Legacy",
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
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        const profilesCallCount = from.mock.calls.filter(([name]) => name === "profiles").length;

        if (profilesCallCount === 1) return missingAccountTypeQuery;
        if (profilesCallCount === 2) return operatorQuery;
        return legacyProfileQuery;
      }

      if (
        table === "donations" ||
        table === "certificates" ||
        table === "trial_code_redemptions" ||
        table === "desktop_sessions" ||
        table === "license_entitlements" ||
        table === "cloud_sync_leases" ||
        table === "cloud_sync_usage_sessions" ||
        table === "cloud_sync_usage_events" ||
        table === "cloud_sync_cooldown_overrides" ||
        table === "support_feedback" ||
        table === "user_login_history"
      ) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "User operations" })).toBeInTheDocument();
    expect(screen.getAllByText("legacy@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
    expect(missingAccountTypeQuery.select).toHaveBeenCalledWith("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,account_type,is_admin,avatar_url,created_at");
    expect(legacyProfileQuery.select).toHaveBeenCalledWith("id,email,display_name,public_display_name,public_supporter_enabled,admin_role,account_status,is_admin,avatar_url,created_at");
  });

  it("opens user detail when Supabase returns a postgres missing column error for legacy account type schema", async () => {
    const missingAccountTypeQuery = createAdminListQuery(null, {
      code: "42703",
      message: "column profiles.account_type does not exist",
    } as Error);
    const legacyProfileQuery = createAdminListQuery({
      id: "user-1",
      email: "postgres-error@example.com",
      display_name: "Postgres Error User",
      public_display_name: "Postgres Error",
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
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        const profilesCallCount = from.mock.calls.filter(([name]) => name === "profiles").length;

        if (profilesCallCount === 1) return missingAccountTypeQuery;
        if (profilesCallCount === 2) return operatorQuery;
        return legacyProfileQuery;
      }

      if (
        table === "donations" ||
        table === "certificates" ||
        table === "trial_code_redemptions" ||
        table === "desktop_sessions" ||
        table === "license_entitlements" ||
        table === "cloud_sync_leases" ||
        table === "cloud_sync_usage_sessions" ||
        table === "cloud_sync_usage_events" ||
        table === "cloud_sync_cooldown_overrides" ||
        table === "support_feedback" ||
        table === "user_login_history"
      ) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });
    requireAdminMock.mockResolvedValue({ id: "admin-operator" });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-1", locale: "en" }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "User operations" })).toBeInTheDocument();
    expect(screen.getAllByText("postgres-error@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
  });

  it("shows an admin user unavailable state instead of a global 404 when the profile is gone", async () => {
    const profileQuery = createAdminListQuery(null, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } as Error);
    const emptyQuery = createAdminListQuery([]);
    const from = vi.fn((table: string) => {
      if (table === "profiles") return profileQuery;
      if (
        table === "donations" ||
        table === "certificates" ||
        table === "trial_code_redemptions" ||
        table === "desktop_sessions" ||
        table === "license_entitlements" ||
        table === "cloud_sync_leases" ||
        table === "cloud_sync_usage_sessions" ||
        table === "cloud_sync_usage_events" ||
        table === "cloud_sync_cooldown_overrides" ||
        table === "support_feedback" ||
        table === "user_login_history"
      ) {
        return emptyQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from });

    render(await AdminUserDetailPage({
      params: Promise.resolve({ id: "user-missing", locale: "en" }),
    }));

    expect(screen.getByRole("heading", { name: "User record unavailable" })).toBeInTheDocument();
    expect(screen.getByText("The user record user-missing is no longer available in the active account table.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User management" })).toHaveAttribute("href", "/admin/users");
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
            account_type: "ai_test",
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
    const latestLoginQuery = createAdminListQuery([
      {
        user_id: "user-1",
        logged_in_at: "2026-05-01T02:00:00.000Z",
      },
    ]);
    const ownerQuery = createAdminListQuery({
      admin_role: "owner",
      is_admin: true,
      account_status: "active",
    });
    const from = vi.fn((table: string) => {
      if (table === "profiles") {
        return from.mock.calls.filter(([name]) => name === "profiles").length === 1 ? ownerQuery : ownerQuery;
      }

      if (table === "user_login_history") return latestLoginQuery;
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
    expect(document.body.textContent).toContain("Last sign-in");
    expect(document.body.textContent).toContain("10:00");
    expect(screen.getAllByText("AI test").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("alice")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select alice@example.com"));
    expect(screen.getByRole("combobox", { name: "Target type" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk change type" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bulk soft delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk soft delete selected users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "alice@example.com" })).toHaveAttribute("href", "/admin/users/user-1");
    expect(screen.queryByRole("link", { name: "Manage user" })).not.toBeInTheDocument();
    expect(document.querySelector('select[name="account_status"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    const moreActionsTrigger = screen.getAllByRole("button", { name: "More actions" })[0];
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(moreActionsTrigger);
    const moreActions = screen.getByRole("menu");
    expect(within(moreActions).getByRole("link", { name: "View details" })).toHaveAttribute("href", "/admin/users/user-1");
    expect(moreActions).toContainElement(screen.getAllByRole("button", { name: "Enable account" })[0]);
    expect(moreActions).toContainElement(screen.getAllByRole("button", { name: "Soft delete" })[0]);
    expect(screen.queryByText("Detailed account, contributions, certificates, and devices")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-mobile-cards")).toHaveTextContent("alice@example.com");
  });

  it("passes the AI test account type filter to the admin users RPC", async () => {
    const rpc = vi.fn((fnName: string) => {
      if (fnName === "get_admin_users_paginated") {
        return Promise.resolve({
          data: [
            {
              users: [],
              total_count: 0,
              filtered_count: 0,
            },
          ],
          error: null,
        });
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
        return ownerQuery;
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions" || table === "user_login_history") return emptyQuery;

      throw new Error(`Unexpected table: ${table}`);
    });
    createSupabaseAdminClientMock.mockReturnValue({ from, rpc });
    requireAdminMock.mockResolvedValue({ id: "admin-owner" });

    render(await AdminUsersPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ type: "ai_test" }),
    }));

    expect(rpc).toHaveBeenCalledWith("get_admin_users_paginated", expect.objectContaining({
      input_type_filter: "ai_test",
    }));
    expect(screen.getByRole("combobox", { name: "User type" })).toHaveValue("ai_test");
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

      if (table === "trial_code_redemptions" || table === "desktop_sessions" || table === "user_login_history") return emptyQuery;

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

  it("explains password setup as optional for OAuth-only user details", async () => {
    const profileQuery = createAdminListQuery({
      id: "user-1",
      email: "oauth@example.com",
      display_name: "OAuth User",
      public_display_name: "OAuth User",
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
          email: "oauth@example.com",
          has_password: false,
          invited_at: null,
          email_confirmed_at: "2026-05-01T00:00:00.000Z",
          confirmed_at: "2026-05-01T00:00:00.000Z",
          recovery_sent_at: null,
          last_sign_in_at: "2026-05-01T01:00:00.000Z",
          banned_until: null,
          deleted_at: null,
          identity_providers: ["google"],
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

    expect(screen.getByText("OAuth sign-in")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Email password not set")).toBeInTheDocument();
    expect(screen.queryByText("No password")).not.toBeInTheDocument();
    expect(screen.getByText("This account can sign in with OAuth. Send a setup email only if the user also wants email and password sign-in.")).toBeInTheDocument();
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
