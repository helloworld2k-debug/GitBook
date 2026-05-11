import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[locale]/desktop/authorize/route";
import { POST } from "@/app/api/desktop/auth/exchange/route";

const mocks = vi.hoisted(() => ({
  createDesktopAuthCode: vi.fn(),
  exchangeDesktopAuthCode: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  serverGetUser: vi.fn(),
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
  const adminClient = { auth: { admin: { getUserById: vi.fn() } }, from: vi.fn() };

  beforeEach(() => {
    adminClient.auth.admin.getUserById.mockReset().mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "dev@example.com",
          user_metadata: { full_name: "Dev User", name: "Developer" },
        },
      },
    });
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue(adminClient);
    mocks.exchangeDesktopAuthCode.mockReset().mockResolvedValue({
      sessionToken: "desktop-token",
      expiresAt: "2026-05-31T00:00:00.000Z",
      userId: "user-1",
      desktopSessionId: "session-1",
    });
  });

  it("rejects invalid request bodies with 400", async () => {
    const response = await POST(
      new Request("https://gitbookai.example/api/desktop/auth/exchange", {
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
      new Request("https://gitbookai.example/api/desktop/auth/exchange", {
        body: JSON.stringify({
          code: "a".repeat(20),
          deviceId: "device-a",
          machineCode: "machine-a",
          platform: "macos",
          state: "state-123",
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
      new Request("https://gitbookai.example/api/desktop/auth/exchange", {
        body: JSON.stringify({
          code: "a".repeat(20),
          deviceId: "device-a",
          machineCode: "machine-a",
          platform: "macos",
          state: "state-123",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to exchange desktop auth code" });
  });

  it("returns desktop token details for valid exchanges", async () => {
    const response = await POST(
      new Request("https://gitbookai.example/api/desktop/auth/exchange", {
        body: JSON.stringify({
          code: "a".repeat(20),
          deviceId: "device-a",
          machineCode: "machine-a",
          platform: "macos",
          state: "state-123",
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
      user: {
        id: "user-1",
        email: "dev@example.com",
        name: "Dev User",
      },
    });
  });
});

describe("desktop authorize route", () => {
  const adminClient = { auth: { getUser: mocks.getUser }, from: vi.fn() };

  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.serverGetUser.mockReset().mockResolvedValue({ data: { user: null } });
    mocks.createSupabaseServerClient.mockReset().mockResolvedValue({ auth: { getUser: mocks.serverGetUser } });
    adminClient.from.mockReset();
    mocks.createSupabaseAdminClient.mockReset().mockReturnValue(adminClient);
    mocks.createDesktopAuthCode.mockReset().mockResolvedValue({
      code: "raw-code",
      expiresAt: "2026-05-01T00:05:00.000Z",
    });
  });

  it("rejects unsupported locales with 404", async () => {
    const response = await GET(new Request("https://gitbookai.example/fr/desktop/authorize"), {
      params: Promise.resolve({ locale: "fr" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported locale" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects callback URLs outside the desktop auth protocol", async () => {
    const response = await GET(
      new Request(
        "https://gitbookai.example/en/desktop/authorize?device_session_id=session-1&return_url=https%3A%2F%2Fevil.example%2Fcallback&state=state-123",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing desktop authorization parameters" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects callback prefix bypass attempts", async () => {
    const response = await GET(
      new Request(
        "https://gitbookai.example/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback.evil&state=state-123",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing desktop authorization parameters" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects callback URLs with caller query parameters", async () => {
    const response = await GET(
      new Request(
        "https://gitbookai.example/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback%3Fstate%3Dabc&state=state-123",
      ),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing desktop authorization parameters" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("redirects anonymous users to locale desktop login with the authorize URL as next", async () => {
    const response = await GET(
      new Request(
        "https://gitbookai.example/ja/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback&state=state-123",
      ),
      {
        params: Promise.resolve({ locale: "ja" }),
      },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://gitbookai.example/ja/desktop/login?next=%2Fja%2Fdesktop%2Fauthorize%3Fdevice_session_id%3Dsession-1%26return_url%3Dgitbookai%253A%252F%252Fauth%252Fcallback%26state%3Dstate-123",
    );
    expect(mocks.createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.createDesktopAuthCode).not.toHaveBeenCalled();
  });

  it("redirects users without a valid server session to locale login", async () => {
    mocks.serverGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET(
      new Request(
        "https://gitbookai.example/ja/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback&state=state-123",
      ),
      {
        params: Promise.resolve({ locale: "ja" }),
      },
    );

    expect(response.status).toBe(307);
    expect(mocks.createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.createDesktopAuthCode).not.toHaveBeenCalled();
  });

  it("creates an auth code for signed-in users and returns a browser deep-link bridge", async () => {
    mocks.serverGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

    const response = await GET(
      new Request("https://gitbookai.example/en/desktop/authorize?device_session_id=session-1&return_url=gitbookai%3A%2F%2Fauth%2Fcallback&state=state-123"),
      {
        params: Promise.resolve({ locale: "en" }),
      },
    );

    expect(mocks.createSupabaseServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createDesktopAuthCode).toHaveBeenCalledWith(adminClient, {
      userId: "user-1",
      deviceSessionId: "session-1",
      returnUrl: "gitbookai://auth/callback",
      state: "state-123",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toContain("gitbookai://auth/callback?code=raw-code&state=state-123");
  });
});
