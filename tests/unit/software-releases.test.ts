import { describe, expect, it, vi } from "vitest";
import { getLatestPublishedRelease, getPlatformDelivery, getPublishedReleases } from "@/lib/releases/software-releases";

function createReleaseClient(rows: unknown[]) {
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example/${path}` },
  }));
  const limit = vi.fn(async () => ({ data: rows.slice(0, 1), error: null }));
  const order = vi.fn(() => ({ order, limit, then: (resolve: (value: unknown) => void) => resolve({ data: rows, error: null }) }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const storageFrom = vi.fn(() => ({ getPublicUrl }));

  return {
    client: { from, storage: { from: storageFrom } },
    from,
    getPublicUrl,
    limit,
  };
}

describe("software release queries", () => {
  it("returns the newest published release with public asset URLs", async () => {
    const { client, from, getPublicUrl, limit } = createReleaseClient([
      {
        id: "release-2",
        version: "v1.2.0",
        released_at: "2026-04-30",
        notes: "Fast AI indexing",
        delivery_mode: "file",
        macos_primary_url: null,
        macos_backup_url: null,
        windows_primary_url: null,
        windows_backup_url: null,
        software_release_assets: [
          {
            id: "asset-mac",
            platform: "macos",
            file_name: "GitBookAI.dmg",
            storage_path: "release-2/macos/GitBookAI.dmg",
            file_size: 1024,
          },
        ],
      },
    ]);

    const release = await getLatestPublishedRelease(client);

    expect(from).toHaveBeenCalledWith("software_releases");
    expect(limit).toHaveBeenCalledWith(1);
    expect(getPublicUrl).toHaveBeenCalledWith("release-2/macos/GitBookAI.dmg");
    expect(release).toEqual({
      id: "release-2",
      version: "v1.2.0",
      releasedAt: "2026-04-30",
      notes: "Fast AI indexing",
      deliveryMode: "file",
      macosPrimaryUrl: null,
      macosBackupUrl: null,
      windowsPrimaryUrl: null,
      windowsBackupUrl: null,
      isPublished: undefined,
      assets: [
        {
          id: "asset-mac",
          platform: "macos",
          fileName: "GitBookAI.dmg",
          storagePath: "release-2/macos/GitBookAI.dmg",
          fileSize: 1024,
          downloadUrl: "https://cdn.example/release-2/macos/GitBookAI.dmg",
        },
      ],
    });
  });

  it("lists published releases newest first with macOS and Windows assets", async () => {
    const { client } = createReleaseClient([
      {
        id: "release-2",
        version: "v1.2.0",
        released_at: "2026-04-30",
        notes: null,
        delivery_mode: "link",
        macos_primary_url: "https://downloads.example/mac-primary.dmg",
        macos_backup_url: "https://mirror.example/mac-backup.dmg",
        windows_primary_url: "https://downloads.example/win-primary.exe",
        windows_backup_url: null,
        software_release_assets: [
        ],
      },
      {
        id: "release-1",
        version: "v1.1.0",
        released_at: "2026-04-01",
        notes: "Older build",
        delivery_mode: "file",
        macos_primary_url: null,
        macos_backup_url: null,
        windows_primary_url: null,
        windows_backup_url: null,
        software_release_assets: [],
      },
    ]);

    const releases = await getPublishedReleases(client);

    expect(releases).toHaveLength(2);
    expect(releases[0]?.version).toBe("v1.2.0");
    expect(releases[0]?.deliveryMode).toBe("link");
    expect(getPlatformDelivery(releases[0]!, "macos")).toMatchObject({
      backupUrl: "https://mirror.example/mac-backup.dmg",
      primaryUrl: "https://downloads.example/mac-primary.dmg",
      source: "link",
    });
    expect(getPlatformDelivery(releases[0]!, "windows")).toMatchObject({
      backupUrl: null,
      primaryUrl: "https://downloads.example/win-primary.exe",
      source: "link",
    });
  });
});
