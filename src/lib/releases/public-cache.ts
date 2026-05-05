import { unstable_cache } from "next/cache";
import { getLatestPublishedRelease, getPublishedReleases, type ReleaseClient } from "@/lib/releases/software-releases";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const PUBLIC_RELEASE_REVALIDATE_SECONDS = 300;

export const getCachedLatestPublishedRelease = unstable_cache(
  async () => getLatestPublishedRelease(createSupabasePublicClient() as unknown as ReleaseClient),
  ["latest-published-release"],
  {
    revalidate: PUBLIC_RELEASE_REVALIDATE_SECONDS,
    tags: ["software-releases"],
  },
);

export const getCachedPublishedReleases = unstable_cache(
  async () => getPublishedReleases(createSupabasePublicClient() as unknown as ReleaseClient),
  ["published-releases"],
  {
    revalidate: PUBLIC_RELEASE_REVALIDATE_SECONDS,
    tags: ["software-releases"],
  },
);
