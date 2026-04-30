import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateAccountProfile, updateDashboardPassword } from "@/app/[locale]/dashboard/actions";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const requireUserMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: requireUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("dashboard account actions", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    requireUserMock.mockReset().mockResolvedValue({ id: "user-1", email: "user@example.com" });
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it("updates the signed-in user's display names", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const formData = new FormData();
    formData.set("display_name", "Ada");
    formData.set("public_display_name", "Ada Supporter");

    await expect(updateAccountProfile("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?profile=saved");

    expect(update).toHaveBeenCalledWith({ display_name: "Ada", public_display_name: "Ada Supporter" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("rejects mismatched password confirmation before calling Supabase", async () => {
    const updateUser = vi.fn();
    createSupabaseServerClientMock.mockResolvedValue({ auth: { updateUser } });

    const formData = new FormData();
    formData.set("password", "new-password-1");
    formData.set("confirm_password", "different-password");

    await expect(updateDashboardPassword("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/dashboard?password=mismatch");

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the current user's password when confirmation matches", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    createSupabaseServerClientMock.mockResolvedValue({ auth: { updateUser } });

    const formData = new FormData();
    formData.set("password", "new-password-1");
    formData.set("confirm_password", "new-password-1");

    await expect(updateDashboardPassword("ko", formData)).rejects.toThrow("NEXT_REDIRECT:/ko/dashboard?password=saved");

    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
  });
});
