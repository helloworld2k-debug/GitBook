import { describe, expect, it, vi } from "vitest";
import { PUBLIC_DISPLAY_NAME_MAX_LENGTH, updatePublicSupporterProfile } from "@/lib/profile/privacy";

function createSupabase(userId: string | null) {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
    from,
    update,
    eq,
  };
}

describe("updatePublicSupporterProfile", () => {
  it("requires a signed-in user", async () => {
    const supabase = createSupabase(null);

    await expect(
      updatePublicSupporterProfile(supabase, {
        publicSupporterEnabled: true,
        publicDisplayName: "Ada",
      }),
    ).rejects.toThrow("Sign in is required to update supporter privacy.");

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("updates only the current user's public supporter fields", async () => {
    const supabase = createSupabase("user_123");

    await updatePublicSupporterProfile(supabase, {
      publicSupporterEnabled: true,
      publicDisplayName: "  Ada Lovelace  ",
    });

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.update).toHaveBeenCalledWith({
      public_supporter_enabled: true,
      public_display_name: "Ada Lovelace",
      updated_at: expect.any(String),
    });
    expect(supabase.eq).toHaveBeenCalledWith("id", "user_123");
  });

  it("stores an empty public display name as null", async () => {
    const supabase = createSupabase("user_123");

    await updatePublicSupporterProfile(supabase, {
      publicSupporterEnabled: false,
      publicDisplayName: "   ",
    });

    expect(supabase.update).toHaveBeenCalledWith({
      public_supporter_enabled: false,
      public_display_name: null,
      updated_at: expect.any(String),
    });
  });

  it("limits public display names before updating the public profile", async () => {
    const supabase = createSupabase("user_123");
    const longName = "A".repeat(PUBLIC_DISPLAY_NAME_MAX_LENGTH + 20);

    await updatePublicSupporterProfile(supabase, {
      publicSupporterEnabled: true,
      publicDisplayName: longName,
    });

    expect(supabase.update).toHaveBeenCalledWith({
      public_supporter_enabled: true,
      public_display_name: "A".repeat(PUBLIC_DISPLAY_NAME_MAX_LENGTH),
      updated_at: expect.any(String),
    });
  });
});
