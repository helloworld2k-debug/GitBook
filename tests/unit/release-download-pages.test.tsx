import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/[locale]/page";
import VersionsPage, { generateStaticParams as generateVersionStaticParams } from "@/app/[locale]/versions/page";

const mocks = vi.hoisted(() => ({
  getCachedLatestPublishedRelease: vi.fn(),
  getCachedPublishedReleases: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
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

vi.mock("@/lib/releases/public-cache", () => ({
  getCachedLatestPublishedRelease: mocks.getCachedLatestPublishedRelease,
  getCachedPublishedReleases: mocks.getCachedPublishedReleases,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const tables: Record<string, Record<string, string>> = {
      home: {
        eyebrow: "AI coding book tool",
        title: "GitBook AI",
        subtitle: "Download the AI-powered coding book companion.",
        downloadMacAppleSilicon: "Download for macOS M chip",
        downloadMacIntel: "Download for macOS Intel",
        downloadWindows: "Download for Windows",
        downloadPending: "Coming soon",
        latestVersion: "Latest version {version} · {date}",
        latestVersionPending: "Latest version is being prepared",
        olderVersions: "Older versions",
        supportPrompt: "Support prompt",
        featureOneTitle: "One",
        featureOneText: "One",
        featureTwoTitle: "Two",
        featureTwoText: "Two",
        featureThreeTitle: "Three",
        featureThreeText: "Three",
        relatedTitle: "Related content",
        relatedSubtitle: "Keep going with releases, support, and account tools.",
        relatedVersionsTitle: "Release archive",
        relatedVersionsText: "Download previous versions.",
        relatedContributionsTitle: "Contributions",
        relatedContributionsText: "Support continued development.",
        relatedSupportTitle: "Support",
        relatedSupportText: "Send feedback and get help.",
        relatedNotificationsTitle: "Notifications",
        relatedNotificationsText: "Read product updates.",
        mockTitle: "Knowledge engine",
        mockStatus: "Online",
        mockLineOne: "Line 1",
        mockLineTwo: "Line 2",
        mockLineThree: "Line 3",
        primaryLink: "Primary",
        backupLink: "Backup",
      },
      nav: {
        donate: "Contributions",
      },
      versions: {
        eyebrow: "Release archive",
        title: "Older versions",
        subtitle: "Download previous builds.",
        empty: "No public releases have been published yet.",
        downloadMacAppleSilicon: "macOS M chip",
        downloadMacIntel: "macOS Intel",
        downloadWindows: "Windows",
        "releases.primaryLink": "Primary",
        "releases.backupLink": "Backup",
      },
    };

    return (key: string, values?: Record<string, string>) => {
      const raw = tables[namespace]?.[key] ?? key;
      return Object.entries(values ?? {}).reduce((message, [name, replacement]) => message.replaceAll(`{${name}}`, replacement), raw);
    };
  }),
  setRequestLocale: vi.fn(),
}));

describe("release download pages", () => {
  it("pre-renders the release archive for every supported locale", () => {
    expect(generateVersionStaticParams()).toEqual([
      { locale: "en" },
      { locale: "zh-Hant" },
      { locale: "ja" },
      { locale: "ko" },
    ]);
  });

  it("shows primary and backup download actions for the latest linked release on the homepage", async () => {
    mocks.getCachedLatestPublishedRelease.mockResolvedValue({
      assets: [],
      deliveryMode: "link",
      id: "release-1",
      isPublished: true,
      macosBackupUrl: "https://mirror.example/mac-backup.dmg",
      macosPrimaryUrl: "https://downloads.example/mac-primary.dmg",
      notes: null,
      releasedAt: "2026-05-05",
      version: "v1.3.0",
      windowsBackupUrl: "https://mirror.example/win-backup.exe",
      windowsPrimaryUrl: "https://downloads.example/win-primary.exe",
    });

    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("link", { name: "Download for macOS M chip" })).toHaveAttribute("href", "https://downloads.example/mac-primary.dmg");
    expect(screen.getByRole("link", { name: "Download for macOS Intel" })).toHaveAttribute("href", "https://downloads.example/mac-primary.dmg");
    expect(screen.getByRole("link", { name: "Download for Windows" })).toHaveAttribute("href", "https://downloads.example/win-primary.exe");
    expect(screen.getByRole("link", { name: "macOS M chip Backup" })).toHaveAttribute("href", "https://mirror.example/mac-backup.dmg");
    expect(screen.getByRole("link", { name: "macOS Intel Backup" })).toHaveAttribute("href", "https://mirror.example/mac-backup.dmg");
    expect(screen.getByRole("link", { name: "Windows Backup" })).toHaveAttribute("href", "https://mirror.example/win-backup.exe");
  });

  it("keeps missing current-release platforms visible as pending and hides older versions", async () => {
    mocks.getCachedLatestPublishedRelease.mockResolvedValue({
      assets: [
        {
          id: "asset-arm",
          platform: "macos_arm64",
          fileName: "GitBook-arm64.dmg",
          storagePath: "release-1/macos_arm64/GitBook-arm64.dmg",
          fileSize: 42,
          downloadUrl: "https://cdn.example/GitBook-arm64.dmg",
        },
        {
          id: "asset-win",
          platform: "windows",
          fileName: "GitBook.exe",
          storagePath: "release-1/windows/GitBook.exe",
          fileSize: 42,
          downloadUrl: "https://cdn.example/GitBook.exe",
        },
      ],
      deliveryMode: "file",
      id: "release-1",
      isPublished: true,
      macosArm64BackupUrl: null,
      macosArm64PrimaryUrl: null,
      macosBackupUrl: null,
      macosPrimaryUrl: null,
      macosX64BackupUrl: null,
      macosX64PrimaryUrl: null,
      notes: null,
      releasedAt: "2026-05-20",
      releaseStatus: "ready",
      version: "v1.5.0",
      windowsBackupUrl: null,
      windowsPrimaryUrl: null,
    });

    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("link", { name: "Download for macOS M chip" })).toHaveAttribute("href", "https://cdn.example/GitBook-arm64.dmg");
    expect(screen.getByRole("link", { name: "Download for Windows" })).toHaveAttribute("href", "https://cdn.example/GitBook.exe");
    expect(screen.queryByRole("link", { name: "Download for macOS Intel" })).not.toBeInTheDocument();
    expect(screen.getByText("Download for macOS Intel")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Older versions" })).not.toBeInTheDocument();
  });

  it("does not show related content links on the homepage", async () => {
    mocks.getCachedLatestPublishedRelease.mockResolvedValue(null);

    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.queryByRole("heading", { name: "Related content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Release archive Download previous versions/ })).not.toBeInTheDocument();
  });

  it("hides the public release archive behind not found", async () => {
    expect(() => VersionsPage()).toThrow("notFound");
    expect(mocks.getCachedPublishedReleases).not.toHaveBeenCalled();
  });
});
