import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminReleasesPage from "@/app/[locale]/admin/releases/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getAdminShellProps: vi.fn(),
  setupAdminPage: vi.fn(),
}));

vi.mock("@/components/admin/admin-release-delivery-mode-fields", () => ({
  AdminReleaseDeliveryModeFields: () => <div>Create release delivery controls</div>,
}));

vi.mock("@/components/admin/admin-release-missing-asset-upload", () => ({
  AdminReleaseMissingAssetUpload: ({ labels }: { labels: { addInstaller: string } }) => (
    <button type="button">{labels.addInstaller}</button>
  ),
}));

vi.mock("@/components/admin/admin-release-bulk-controls", () => ({
  AdminReleaseSelectAllCheckbox: ({ label }: { label: string }) => <input aria-label={label} type="checkbox" />,
}));

vi.mock("@/components/admin/admin-shell", () => ({
  AdminCard: ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
  AdminFeedbackBanner: ({
    getMessage,
    notice,
  }: {
    getMessage?: (key: string) => string;
    notice?: string | string[] | null;
  }) => {
    const rawNotice = Array.isArray(notice) ? notice[0] : notice;

    if (!rawNotice || !getMessage) {
      return null;
    }

    const translationKey = rawNotice === "release-created" ? "releaseCreated" : rawNotice;

    return <div role="status">{getMessage(`admin.feedback.${translationKey}`)}</div>;
  },
  AdminPageHeader: ({ description, title }: { description?: string; title: string }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  AdminStatusBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  AdminTableShell: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div aria-label={label} role="region">
      {children}
    </div>
  ),
}));

vi.mock("@/components/confirm-action-button", () => ({
  ConfirmActionButton: ({ children }: { children: React.ReactNode }) => <button type="submit">{children}</button>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      "common.processing": "Processing...",
      "admin.feedback.releaseCreated": "Version created.",
      "releases.addInstaller": "Add installer",
      "releases.applyFilters": "Apply filters",
      "releases.assets": "Assets",
      "releases.backupLink": "Backup",
      "releases.bulkAction": "Bulk action",
      "releases.bulkDeleteDrafts": "Delete selected drafts",
      "releases.bulkPublish": "Publish selected",
      "releases.bulkUnpublish": "Unpublish selected",
      "releases.comingSoon": "Pending",
      "releases.create": "Create release",
      "releases.createLinkRelease": "Create link release",
      "releases.createTitle": "Create release",
      "releases.dateColumn": "Date",
      "releases.deleteDraft": "Delete draft",
      "releases.deliveryMode": "Delivery mode",
      "releases.deliveryModeFile": "Upload files",
      "releases.deliveryModeFileHelp": "Upload separate installers.",
      "releases.deliveryModeLink": "Use download links",
      "releases.deliveryModeLinkHelp": "Provide download links.",
      "releases.description": "Upload installers and control public release availability.",
      "releases.empty": "No releases found.",
      "releases.historyTableLabel": "Release history",
      "releases.historyTitle": "Release history",
      "releases.macAppleSiliconBackupUrl": "macOS M chip backup URL",
      "releases.macAppleSiliconFile": "macOS M chip installer",
      "releases.macAppleSiliconPrimaryUrl": "macOS M chip primary URL",
      "releases.macIntelBackupUrl": "macOS Intel backup URL",
      "releases.macIntelFile": "macOS Intel installer",
      "releases.macIntelPrimaryUrl": "macOS Intel primary URL",
      "releases.maxFileSizeHelp": "Max 50 MB per file.",
      "releases.modeColumn": "Mode",
      "releases.modeFile": "File delivery",
      "releases.modeLink": "Link delivery",
      "releases.notes": "Release notes",
      "releases.platformFilter": "Platform completeness",
      "releases.platformPending": "{platform} pending",
      "releases.platformReady": "{platform} ready",
      "releases.platformsColumn": "Platforms",
      "releases.primaryLink": "Primary",
      "releases.publish": "Publish",
      "releases.published": "Published",
      "releases.publishMode": "Publish status",
      "releases.publishModeDraft": "Save as draft",
      "releases.publishModePublish": "Publish after upload",
      "releases.releasedAt": "Release date",
      "releases.retryUpload": "Retry",
      "releases.pauseUpload": "Pause",
      "releases.resumeUpload": "Resume",
      "releases.search": "Search releases",
      "releases.searchPlaceholder": "Version or notes",
      "releases.selectAllReleases": "Select all releases",
      "releases.selectRelease": "Select {version}",
      "releases.selectedCount": "Select releases to bulk process",
      "releases.statusColumn": "Status",
      "releases.statusFilter": "Release status",
      "releases.statuses.draft": "Draft",
      "releases.statuses.failed": "Failed",
      "releases.statuses.ready": "Ready",
      "releases.statuses.uploading": "Uploading",
      "releases.unpublish": "Unpublish",
      "releases.uploadAndPublish": "Upload and publish release",
      "releases.uploadAndSaveDraft": "Upload and save draft",
      "releases.uploadComplete": "Complete",
      "releases.uploadFailed": "Upload failed",
      "releases.uploadIdle": "Ready",
      "releases.uploadLimitError": "Installer files must be 50 MB or smaller.",
      "releases.uploadProgress": "Upload progress",
      "releases.uploadStepComplete": "Release created",
      "releases.uploadStepFinalizing": "Creating release",
      "releases.uploadStepPreparing": "Preparing release",
      "releases.uploadStepUploading": "Uploading installers",
      "releases.uploadSummary": "Selected {count} platforms: {platforms}.",
      "releases.uploadUploading": "Uploading",
      "releases.version": "Version",
      "releases.versionColumn": "Version",
      "releases.windowsBackupUrl": "Windows backup URL",
      "releases.windowsFile": "Windows installer",
      "releases.windowsPrimaryUrl": "Windows primary URL",
      "shell.backToAdmin": "Back to admin",
    };

    return messages[key] ?? key;
  }),
}));

vi.mock("@/lib/admin/shell", () => ({
  getAdminShellProps: mocks.getAdminShellProps,
}));

vi.mock("@/lib/auth/page-guards", () => ({
  setupAdminPage: mocks.setupAdminPage,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/app/[locale]/admin/actions", () => ({
  bulkUpdateSoftwareReleases: vi.fn(),
  createSoftwareRelease: vi.fn(),
  deleteDraftSoftwareRelease: vi.fn(),
  setSoftwareReleasePublished: vi.fn(),
}));

function createReleaseQuery(data: unknown[]) {
  const query = {
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    then(resolve: (value: { data: unknown[]; error: null }) => void) {
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return query;
}

describe("AdminReleasesPage", () => {
  it("renders release history as a compact operations table with platform pending states and bulk controls", async () => {
    mocks.setupAdminPage.mockResolvedValue({ locale: "en", user: { id: "admin-1" } });
    mocks.getAdminShellProps.mockResolvedValue({
      adminLabel: "Operator",
      currentPath: "/admin/releases",
      labels: {},
      locale: "en",
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: (table: string) => {
        if (table !== "software_releases") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return createReleaseQuery([
          {
            delivery_mode: "file",
            id: "release-1",
            is_published: true,
            macos_arm64_backup_url: null,
            macos_arm64_primary_url: null,
            macos_backup_url: null,
            macos_primary_url: null,
            macos_x64_backup_url: null,
            macos_x64_primary_url: null,
            notes: "Stability fixes",
            release_status: "ready",
            released_at: "2026-05-24",
            software_release_assets: [
              {
                file_name: "GitBookAI-mac-arm64.zip",
                file_size: 1000,
                id: "asset-arm",
                platform: "macos_arm64",
                storage_path: "release-1/macos_arm64/GitBookAI.zip",
              },
              {
                file_name: "GitBookAI-win.zip",
                file_size: 1000,
                id: "asset-win",
                platform: "windows",
                storage_path: "release-1/windows/GitBookAI.zip",
              },
            ],
            version: "v1.5.0",
            windows_backup_url: null,
            windows_primary_url: null,
          },
        ]);
      },
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } }),
        }),
      },
    });

    render(await AdminReleasesPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Release history" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search releases")).toBeInTheDocument();
    expect(screen.getByLabelText("Release status")).toBeInTheDocument();
    expect(screen.getByLabelText("Platform completeness")).toBeInTheDocument();
    expect(screen.getByLabelText("Select all releases")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bulk action" })).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Release history" });
    expect(within(table).getByRole("columnheader", { name: "Version" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Platforms" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();

    const row = within(table).getByRole("row", { name: /v1\.5\.0/i });
    expect(within(row).getByText("M ready")).toBeInTheDocument();
    expect(within(row).getByText("Intel pending")).toBeInTheDocument();
    expect(within(row).getByText("Win ready")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Add installer" })).toBeInTheDocument();
  });

  it("uses localized feedback messages on release redirects", async () => {
    mocks.setupAdminPage.mockResolvedValue({ locale: "en", user: { id: "admin-1" } });
    mocks.getAdminShellProps.mockResolvedValue({
      adminLabel: "Operator",
      currentPath: "/admin/releases",
      labels: {},
      locale: "en",
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: () => createReleaseQuery([]),
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } }),
        }),
      },
    });

    render(await AdminReleasesPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ notice: "release-created" }),
    }));

    expect(screen.getByRole("status")).toHaveTextContent("Version created.");
  });
});
