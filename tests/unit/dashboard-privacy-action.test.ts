import { describe, expect, it, vi, beforeEach } from "vitest";
import { updatePublicSupporterPrivacy } from "@/app/[locale]/dashboard/actions";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const updatePublicSupporterProfileMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/profile/privacy", () => ({
  updatePublicSupporterProfile: updatePublicSupporterProfileMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("updatePublicSupporterPrivacy", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    updatePublicSupporterProfileMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    createSupabaseServerClientMock.mockResolvedValue({ client: true });
  });

  it("updates the current user's privacy fields and revalidates public pages", async () => {
    const formData = new FormData();
    formData.set("public_supporter_enabled", "on");
    formData.set("public_display_name", "Ada");

    await expect(updatePublicSupporterPrivacy("en", formData)).rejects.toThrow("REDIRECT:/en/dashboard?privacy=saved");

    expect(updatePublicSupporterProfileMock).toHaveBeenCalledWith(
      { client: true },
      {
        publicSupporterEnabled: true,
        publicDisplayName: "Ada",
      },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/dashboard");
    expect(revalidatePathMock).toHaveBeenCalledWith("/en/sponsors");
  });

  it("redirects with an error when the privacy update fails", async () => {
    const formData = new FormData();
    updatePublicSupporterProfileMock.mockRejectedValue(new Error("blocked"));

    await expect(updatePublicSupporterPrivacy("en", formData)).rejects.toThrow("REDIRECT:/en/dashboard?privacy=error");
  });
});
