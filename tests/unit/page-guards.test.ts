import { describe, expect, it, vi } from "vitest";
import { setupAdminPage, setupUserPage } from "@/lib/auth/page-guards";

const requireAdminMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const resolvePageLocaleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: requireAdminMock,
  requireUser: requireUserMock,
}));

vi.mock("@/lib/i18n/page-locale", () => ({
  resolvePageLocale: resolvePageLocaleMock,
}));

describe("page guard setup helpers", () => {
  it("sets up admin pages with a resolved locale and admin guard", async () => {
    resolvePageLocaleMock.mockReturnValue("en");
    requireAdminMock.mockResolvedValue({ id: "admin-1" });

    await expect(setupAdminPage("en", "/en/admin")).resolves.toEqual({
      locale: "en",
      user: { id: "admin-1" },
    });

    expect(resolvePageLocaleMock).toHaveBeenCalledWith("en");
    expect(requireAdminMock).toHaveBeenCalledWith("en", "/en/admin");
  });

  it("sets up user pages with a resolved locale and user guard", async () => {
    resolvePageLocaleMock.mockReturnValue("ja");
    requireUserMock.mockResolvedValue({ id: "user-1" });

    await expect(setupUserPage("ja", "/ja/dashboard")).resolves.toEqual({
      locale: "ja",
      user: { id: "user-1" },
    });

    expect(resolvePageLocaleMock).toHaveBeenCalledWith("ja");
    expect(requireUserMock).toHaveBeenCalledWith("ja", "/ja/dashboard");
  });
});
