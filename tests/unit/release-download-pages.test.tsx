import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/[locale]/page";
import VersionsPage from "@/app/[locale]/versions/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
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

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const tables: Record<string, Record<string, string>> = {
      home: {
        eyebrow: "AI coding book tool",
        title: "GitBook AI",
        subtitle: "Download the AI-powered coding book companion.",
        downloadMac: "Download for macOS",
        downloadWindows: "Download for Windows",
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
        downloadMac: "macOS",
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
  it("shows primary and backup download actions for the latest linked release on the homepage", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    {
                      id: "release-1",
                      version: "v1.3.0",
                      released_at: "2026-05-05",
                      notes: null,
                      delivery_mode: "link",
                      macos_primary_url: "https://downloads.example/mac-primary.dmg",
                      macos_backup_url: "https://mirror.example/mac-backup.dmg",
                      windows_primary_url: "https://downloads.example/win-primary.exe",
                      windows_backup_url: "https://mirror.example/win-backup.exe",
                      software_release_assets: [],
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      })),
      storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn() })) },
    });

    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("link", { name: "Download for macOS" })).toHaveAttribute("href", "https://downloads.example/mac-primary.dmg");
    expect(screen.getByRole("link", { name: "Download for Windows" })).toHaveAttribute("href", "https://downloads.example/win-primary.exe");
    expect(screen.getByRole("link", { name: "macOS Backup" })).toHaveAttribute("href", "https://mirror.example/mac-backup.dmg");
    expect(screen.getByRole("link", { name: "Windows Backup" })).toHaveAttribute("href", "https://mirror.example/win-backup.exe");
  });

  it("shows paired platform actions for linked releases on the versions page", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                then: (resolve: (value: unknown) => void) =>
                  resolve({
                    data: [
                      {
                        id: "release-1",
                        version: "v1.3.0",
                        released_at: "2026-05-05",
                        notes: "Linked build",
                        delivery_mode: "link",
                        macos_primary_url: "https://downloads.example/mac-primary.dmg",
                        macos_backup_url: "https://mirror.example/mac-backup.dmg",
                        windows_primary_url: "https://downloads.example/win-primary.exe",
                        windows_backup_url: null,
                        software_release_assets: [],
                      },
                    ],
                    error: null,
                  }),
              })),
            })),
          })),
        })),
      })),
      storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn() })) },
    });

    render(await VersionsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("link", { name: "macOS Primary" })).toHaveAttribute("href", "https://downloads.example/mac-primary.dmg");
    expect(screen.getByRole("link", { name: "macOS Backup" })).toHaveAttribute("href", "https://mirror.example/mac-backup.dmg");
    expect(screen.getByRole("link", { name: "Windows Primary" })).toHaveAttribute("href", "https://downloads.example/win-primary.exe");
  });
});
