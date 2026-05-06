import { describe, expect, it, vi } from "vitest";
import { hashDesktopSecret } from "@/lib/license/hash";

describe("desktop session auth helpers", () => {
  it("refreshes an active desktop session with token rotation", async () => {
    const { refreshDesktopSession } =
      await vi.importActual<typeof import("@/lib/license/desktop-session")>("@/lib/license/desktop-session");
    const now = new Date("2026-05-01T00:00:00.000Z");
    const rpc = vi.fn(async () => ({
      data: [
        {
          desktop_session_id: "session-a",
          user_id: "user-1",
        },
      ],
      error: null,
    }));

    const result = await refreshDesktopSession(
      { rpc },
      {
        refreshToken: "old-refresh-token",
        now,
      },
    );

    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.expiresAt).toBe("2026-05-31T00:00:00.000Z");
    expect(result.userId).toBe("user-1");
    expect(result.desktopSessionId).toBe("session-a");
    expect(rpc).toHaveBeenCalledWith("refresh_desktop_session", {
      input_current_token_hash: await hashDesktopSecret("old-refresh-token", "desktop_token"),
      input_new_expires_at: "2026-05-31T00:00:00.000Z",
      input_new_token_hash: await hashDesktopSecret(result.sessionToken, "desktop_token"),
      input_now: "2026-05-01T00:00:00.000Z",
    });
  });

  it("throws a typed error when refresh token is revoked or replaced", async () => {
    const { InvalidDesktopSessionError, refreshDesktopSession } =
      await vi.importActual<typeof import("@/lib/license/desktop-session")>("@/lib/license/desktop-session");
    const rpc = vi.fn(async () => ({ data: [], error: null }));

    await expect(
      refreshDesktopSession(
        { rpc },
        {
          refreshToken: "old-refresh-token",
          now: new Date("2026-05-01T00:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(InvalidDesktopSessionError);
  });

  it("revokes the current desktop session through the service-role RPC", async () => {
    const { revokeDesktopSession } =
      await vi.importActual<typeof import("@/lib/license/desktop-session")>("@/lib/license/desktop-session");
    const now = new Date("2026-05-01T00:00:00.000Z");
    const rpc = vi.fn(async () => ({ data: true, error: null }));

    await expect(
      revokeDesktopSession(
        { rpc },
        {
          desktopSessionId: "session-a",
          now,
        },
      ),
    ).resolves.toEqual({ revoked: true });

    expect(rpc).toHaveBeenCalledWith("revoke_desktop_session_with_leases", {
      input_desktop_session_id: "session-a",
      input_now: "2026-05-01T00:00:00.000Z",
    });
  });
});
