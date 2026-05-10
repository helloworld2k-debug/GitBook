import { afterEach, describe, expect, it, vi } from "vitest";

import { logSlowDesktopApi } from "@/lib/api/performance";

describe("desktop API performance logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log fast desktop API requests", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logSlowDesktopApi({
      entitlementMs: 20,
      leaseMs: 30,
      reason: "active",
      requestId: "req-1",
      route: "/api/license/status",
      sessionMs: 10,
      totalMs: 999,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("logs sanitized timing segments for slow desktop API requests", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logSlowDesktopApi({
      entitlementMs: 300,
      leaseMs: 400,
      reason: "active",
      requestId: "req-1",
      route: "/api/license/status",
      sessionMs: 100,
      totalMs: 1200,
    });

    expect(warn).toHaveBeenCalledWith("desktop_api_slow", {
      entitlement_ms: 300,
      lease_ms: 400,
      reason: "active",
      request_id: "req-1",
      route: "/api/license/status",
      session_ms: 100,
      total_ms: 1200,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("token");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("machineCode");
  });
});
