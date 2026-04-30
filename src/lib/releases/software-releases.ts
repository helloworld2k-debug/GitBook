export const SOFTWARE_RELEASES_BUCKET = "software-releases";

export type ReleasePlatform = "macos" | "windows";

export type SoftwareReleaseAsset = {
  id: string;
  platform: ReleasePlatform;
  fileName: string;
  storagePath: string;
  fileSize: number | null;
  downloadUrl: string;
};

export type SoftwareRelease = {
  id: string;
  version: string;
  releasedAt: string;
  notes: string | null;
  isPublished?: boolean;
  assets: SoftwareReleaseAsset[];
};

export function getReleaseAsset(release: SoftwareRelease | null, platform: ReleasePlatform) {
  return release?.assets.find((asset) => asset.platform === platform) ?? null;
}

type ReleaseRow = {
  id: string;
  version: string;
  released_at: string;
  notes: string | null;
  is_published?: boolean;
  software_release_assets?: {
    id: string;
    platform: ReleasePlatform;
    file_name: string;
    storage_path: string;
    file_size: number | null;
  }[];
};

type ReleaseQuery = {
  order: (column: string, options?: { ascending?: boolean }) => ReleaseQuery;
  limit: (count: number) => Promise<{ data: ReleaseRow[] | null; error: Error | null }>;
  then: (resolve: (value: { data: ReleaseRow[] | null; error: Error | null }) => void) => void;
};

export type ReleaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: boolean) => {
        order: (column: string, options?: { ascending?: boolean }) => ReleaseQuery;
      };
    };
  };
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

const RELEASE_SELECT =
  "id,version,released_at,notes,is_published,software_release_assets(id,platform,file_name,storage_path,file_size)";

function mapRelease(row: ReleaseRow, client: ReleaseClient): SoftwareRelease {
  return {
    id: row.id,
    version: row.version,
    releasedAt: row.released_at,
    notes: row.notes,
    isPublished: row.is_published,
    assets: (row.software_release_assets ?? []).map((asset) => ({
      id: asset.id,
      platform: asset.platform,
      fileName: asset.file_name,
      storagePath: asset.storage_path,
      fileSize: asset.file_size,
      downloadUrl: client.storage.from(SOFTWARE_RELEASES_BUCKET).getPublicUrl(asset.storage_path).data.publicUrl,
    })),
  };
}

function createPublishedReleaseQuery(client: ReleaseClient) {
  return client
    .from("software_releases")
    .select(RELEASE_SELECT)
    .eq("is_published", true)
    .order("released_at", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function getLatestPublishedRelease(client: ReleaseClient): Promise<SoftwareRelease | null> {
  const query = createPublishedReleaseQuery(client);

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  const row = data?.[0];

  return row ? mapRelease(row, client) : null;
}

export async function getPublishedReleases(client: ReleaseClient): Promise<SoftwareRelease[]> {
  const query = createPublishedReleaseQuery(client);
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRelease(row, client));
}
