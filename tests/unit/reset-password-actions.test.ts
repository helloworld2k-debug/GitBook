import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateResetPassword } from "@/app/[locale]/reset-password/actions";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("reset password actions", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    const profileQuery = {
      eq: vi.fn(() => profileQuery),
      select: vi.fn(() => profileQuery),
      single: vi.fn(async () => ({ data: { email_verified: true }, error: null })),
    };
    createSupabaseAdminClientMock.mockReset().mockReturnValue({
      from: vi.fn(() => profileQuery),
    });
    redirectMock.mockClear();
  });

  it("rejects mismatched password confirmation before calling Supabase", async () => {
    const updateUser = vi.fn();
    createSupabaseServerClientMock.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })), updateUser } });
    const formData = new FormData();
    formData.set("password", "new-password-1");
    formData.set("confirm_password", "different-password");

    await expect(updateResetPassword("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/reset-password?status=mismatch");

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the recovered user's password and redirects to login", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    createSupabaseServerClientMock.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })), updateUser } });
    const formData = new FormData();
    formData.set("password", "new-password-1");
    formData.set("confirm_password", "new-password-1");

    await expect(updateResetPassword("zh", formData)).rejects.toThrow("NEXT_REDIRECT:/zh/login?password=reset");

    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
  });
});
