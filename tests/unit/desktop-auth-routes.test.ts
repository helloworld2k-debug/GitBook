import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[locale]/desktop/authorize/route";
import { POST } from "@/app/api/desktop/auth/exchange/route";

const mocks = vi.hoisted(() => ({
  createDesktopAuthCode: vi.fn(),
  exchangeDesktopAuthCode: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/license/desktop-auth", () => ({
  createDesktopAuthCode: mocks.createDesktopAuthCode,
  exchangeDesktopAuthCode: mocks.exchangeDesktopAuthCode,
  InvalidDesktopAuthCodeError: class InvalidDesktopAuthCodeError extends Error {
    constructor() {
      super("Invalid or expired desktop auth code");
      this.name = "InvalidDesktopAuthCodeError";
    }
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

describe("desktop auth exchange route", () => {
  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue({ from: vi.fn() });
    mocks.exchangeDesktopAuthCode.mockReset().mockResolvedValue({
      sessionToken: "desktop-token",
      expiresAt: "2026-05-31T00:00:00.000Z",
      userId: "user-1",
      desktopSessionId: "session-1",
    });
  });

  it("rejects invalid request bodies with 400", async () => {
    const response = await POST(
      new Request("https://threefriends.example/api/desktop/auth/exchange", {
        body: JSON.stringify({ code: "short" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid desktop auth exchange request" });
    expect(mocks.exchangeDesktopAuthCode).not.toHaveBeenCalled();
  });

  it("maps invalid auth code exchanges to 401", async () => {
    const { InvalidDesktopAuthCodeError } = await import("@/lib/license/desktop-auth");

    mocks.exchangeDesktopAuthCode.mockRejectedValueOnce(new InvalidDesktopAuthCodeError());

    const response = await POST(
      new Request("https://threefriends.example/api/desktop/auth/exchange", {
        body: JSON.stringify({
          code: "a".repeat(20),
          deviceId: "device-a",
          machineCode: "machine-a",
          platform: "macos",
          appVersion: "1.0.0",
          deviceName: "Studio Mac",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Invalid or expired desktop auth code" });
  });

  it("maps internal exchange failures to 500", async () => {
    mocks.exchangeDesktopAuthCode.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(
      new Request("https://threefriends.example/api/desktop/auth/exchange", {
        body: JSON.stringify({
          code: "a".repeat(20),
          deviceId: "device-a",
          machineCode: "machine-a",
          platform: "macos",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to exchange desktop auth code" });
  });

  it("returns desktop token details for valid exchanges", async () => {
    const response = await POST(
      new Request("https://threefriends.example/api/desktop/auth/exchange", {
        body: JSON.stringify({
          code: "a".repeat(20),
          deviceId: "device-a",
          machineCode: "machine-a",
          platform: "macos",
          appVersion: "1.0.0",
          deviceName: "Studio Mac",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "desktop-token",
      expiresAt: "2026-05-31T00:00:00.000Z",
      userId: "user-1",
      desktopSessionId: "session-1",
    });
  });
});

describe("desktop authorize route", () => {
  const adminClient = { from: vi.fn() };
  const serverClient = { auth: { getUser: mocks.getUser } };

  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    adminClient.from.mockReset();
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue(adminClient);
    mocks.createSupabaseServerClient.mockReset().mockResolvedValue(serverClient);
    mocks.createDesktopAuthCode.mockReset().mockResolvedValue({
      code: "raw-code",
      expiresAt: "2026-05-01T00:05:00.000Z",
    });
  });

  it("rejects unsupported locales with 404", async () => {
    const response = await GET(new Request("https://threefriends.example/fr/desktop/authorize"), {
      params: Promise.resolve({ locale: "fr" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported locale" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects callback URLs outside the desktop auth protocol", async () => {
    const response = await GET(
      new Request(
        "https://threefriends.example/en/desktop/authorize?device_session_id=session-1&return_url=https%3A%2F%2Fevil.example%2Fcallback",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing desktop authorization parameters" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects callback prefix bypass attempts", async () => {
    const response = await GET(
      new Request(
        "https://threefriends.example/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback.evil",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing desktop authorization parameters" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects callback URLs with caller query parameters", async () => {
    const response = await GET(
      new Request(
        "https://threefriends.example/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback%3Fstate%3Dabc",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing desktop authorization parameters" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("redirects anonymous users to locale login with the authorize URL as next", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET(
      new Request(
        "https://threefriends.example/ja/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback",
      ),
      {
        params: Promise.resolve({ locale: "ja" }),
      },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://threefriends.example/ja/login?next=%2Fja%2Fdesktop%2Fauthorize%3Fdevice_session_id%3Dsession-1%26return_url%3Dgitbookai%253A%252F%252Fauth%252Fcallback",
    );
    expect(mocks.createDesktopAuthCode).not.toHaveBeenCalled();
  });

  it("creates an auth code for signed-in users and redirects to the callback", async () => {
    const response = await GET(
      new Request(
        "https://threefriends.example/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(307);
    expect(mocks.createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.createDesktopAuthCode).toHaveBeenCalledWith(adminClient, {
      userId: "user-1",
      deviceSessionId: "session-1",
      returnUrl: "gitbookai://auth/callback",
    });
    expect(response.headers.get("location")).toBe("gitbookai://auth/callback?code=raw-code");
  });
});
