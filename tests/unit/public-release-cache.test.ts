import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabasePublicClient: vi.fn(() => ({ kind: "public-client" })),
  getLatestPublishedRelease: vi.fn(async () => ({ id: "latest-release" })),
  getPublishedReleases: vi.fn(async () => [{ id: "release-1" }]),
  unstableCache: vi.fn((callback: () => unknown) => callback),
}));

vi.mock("next/cache", () => ({
  unstable_cache: mocks.unstableCache,
}));

vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: mocks.createSupabasePublicClient,
}));

vi.mock("@/lib/releases/software-releases", () => ({
  getLatestPublishedRelease: mocks.getLatestPublishedRelease,
  getPublishedReleases: mocks.getPublishedReleases,
}));

describe("public release cache", () => {
  it("reads public release data through a cookie-free public Supabase client", async () => {
    const { getCachedLatestPublishedRelease, getCachedPublishedReleases } = await import("@/lib/releases/public-cache");

    await expect(getCachedLatestPublishedRelease()).resolves.toEqual({ id: "latest-release" });
    await expect(getCachedPublishedReleases()).resolves.toEqual([{ id: "release-1" }]);

    expect(mocks.createSupabasePublicClient).toHaveBeenCalledTimes(2);
    expect(mocks.getLatestPublishedRelease).toHaveBeenCalledWith({ kind: "public-client" });
    expect(mocks.getPublishedReleases).toHaveBeenCalledWith({ kind: "public-client" });
  });

  it("wraps public release lookups in short-lived cache entries", async () => {
    await import("@/lib/releases/public-cache");

    expect(mocks.unstableCache).toHaveBeenCalledWith(expect.any(Function), ["latest-published-release"], {
      revalidate: 300,
      tags: ["software-releases"],
    });
    expect(mocks.unstableCache).toHaveBeenCalledWith(expect.any(Function), ["published-releases"], {
      revalidate: 300,
      tags: ["software-releases"],
    });
  });
});
