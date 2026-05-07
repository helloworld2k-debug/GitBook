import { describe, expect, it, vi } from "vitest";
import { checkRegisterRateLimit } from "@/lib/auth/register-rate-limit";

function createRegisterLimitClient(count: number) {
  const insert = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(() => chain);
  const gte = vi.fn(() => chain);
  const is = vi.fn(() => chain);
  const select = vi.fn(() => chain);
  const chain = {
    eq,
    gte,
    is,
    then: (resolve: (value: { count: number; data: never[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ count, data: [], error: null }).then(resolve, reject),
  };
  const from = vi.fn((table: string) => {
    if (table !== "registration_attempts") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return { insert, select };
  });

  return { from, insert, is, select };
}

describe("checkRegisterRateLimit", () => {
  it("persists registration attempts and allows normal traffic", async () => {
    const client = createRegisterLimitClient(2);

    await expect(checkRegisterRateLimit(client, {
      email: "New@Example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
      userAgent: "Vitest",
    })).resolves.toEqual({ ok: true });

    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({
      email_domain: "example.com",
      email_normalized: "new@example.com",
      ip_address: "203.0.113.10",
      user_agent: "Vitest",
    }));
  });

  it("rate-limits persisted registration attempts across server instances", async () => {
    const client = createRegisterLimitClient(5);

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 600,
    });
  });

  it("handles missing IP addresses with a null-safe query", async () => {
    const client = createRegisterLimitClient(0);

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: null,
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({ ok: true });

    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({
      ip_address: null,
    }));
    expect(client.is).toHaveBeenCalledWith("ip_address", null);
  });
});
