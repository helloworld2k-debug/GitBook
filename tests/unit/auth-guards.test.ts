import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLoginRedirectPath, isAdminProfile, isOwnerProfile, requireAdmin, requireOwner, requireUser } from "@/lib/auth/guards";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
);
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

function createAuthClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
}

function createProfileClient(profile: { is_admin?: boolean; admin_role?: "owner" | "operator" | "user"; account_status?: "active" | "disabled" } | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: profile }),
        })),
      })),
    })),
  };
}

describe("auth guards", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      getAll: vi.fn(() => [{ name: "sb-test-auth-token", value: "token" }]),
    });
    createSupabaseServerClientMock.mockReset();
  });

  it("builds locale-aware login redirects", () => {
    expect(getLoginRedirectPath("ja", "/ja/donate?tier=yearly")).toBe(
      "/ja/login?next=%2Fja%2Fdonate%3Ftier%3Dyearly",
    );
  });

  it("recognizes admin profiles", () => {
    expect(isAdminProfile({ is_admin: true })).toBe(true);
    expect(isAdminProfile({ is_admin: false, admin_role: "operator", account_status: "active" })).toBe(true);
    expect(isAdminProfile({ is_admin: false, admin_role: "user", account_status: "active" })).toBe(false);
    expect(isAdminProfile({ is_admin: false, admin_role: "operator", account_status: "disabled" })).toBe(false);
    expect(isAdminProfile(null)).toBe(false);
  });

  it("recognizes owner profiles", () => {
    expect(isOwnerProfile({ is_admin: true })).toBe(true);
    expect(isOwnerProfile({ admin_role: "owner", account_status: "active" })).toBe(true);
    expect(isOwnerProfile({ admin_role: "operator", account_status: "active" })).toBe(false);
    expect(isOwnerProfile({ admin_role: "owner", account_status: "disabled" })).toBe(false);
  });

  it("redirects users to locale-aware login when no user is present", async () => {
    createSupabaseServerClientMock.mockResolvedValue(createAuthClient(null));

    await expect(requireUser("ja", "/ja/donate?tier=yearly")).rejects.toThrow(
      "redirect:/ja/login?next=%2Fja%2Fdonate%3Ftier%3Dyearly",
    );
    expect(redirectMock).toHaveBeenCalledWith("/ja/login?next=%2Fja%2Fdonate%3Ftier%3Dyearly");
  });

  it("redirects anonymous requests without checking Supabase when no auth cookie is present", async () => {
    cookiesMock.mockResolvedValue({
      getAll: vi.fn(() => []),
    });

    await expect(requireUser("en", "/en/dashboard")).rejects.toThrow("redirect:/en/login?next=%2Fen%2Fdashboard");
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("returns the current user when present", async () => {
    const user = { id: "user-1" };
    createSupabaseServerClientMock.mockResolvedValue(createAuthClient(user));

    await expect(requireUser("en", "/en/dashboard")).resolves.toBe(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects non-admin users to the locale dashboard", async () => {
    createSupabaseServerClientMock
      .mockResolvedValueOnce(createAuthClient({ id: "user-1" }))
      .mockResolvedValueOnce(createProfileClient({ is_admin: false, admin_role: "user", account_status: "active" }));

    await expect(requireAdmin("ko")).rejects.toThrow("redirect:/ko/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/ko/dashboard");
  });

  it("returns the current user when the profile is admin", async () => {
    const user = { id: "admin-1" };
    createSupabaseServerClientMock
      .mockResolvedValueOnce(createAuthClient(user))
      .mockResolvedValueOnce(createProfileClient({ is_admin: false, admin_role: "operator", account_status: "active" }));

    await expect(requireAdmin("en")).resolves.toBe(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects operators away from owner-only pages", async () => {
    createSupabaseServerClientMock
      .mockResolvedValueOnce(createAuthClient({ id: "operator-1" }))
      .mockResolvedValueOnce(createProfileClient({ is_admin: false, admin_role: "operator", account_status: "active" }));

    await expect(requireOwner("en")).rejects.toThrow("redirect:/en/admin");
    expect(redirectMock).toHaveBeenCalledWith("/en/admin");
  });
});
