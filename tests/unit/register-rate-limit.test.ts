import { describe, expect, it, vi } from "vitest";
import { checkRegisterRateLimit } from "@/lib/auth/register-rate-limit";

function createRegisterLimitClient(counts: { domain?: number; emailIp?: number; ip?: number } | number, block?: { blocked_until: string; reason: string } | null) {
  const countValues = typeof counts === "number" ? { emailIp: counts } : counts;
  const insert = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(() => chain);
  const gt = vi.fn(() => chain);
  const gte = vi.fn(() => chain);
  const is = vi.fn(() => chain);
  const maybeSingle = vi.fn(async () => ({ data: block ?? null, error: null }));
  const order = vi.fn(() => chain);
  const select = vi.fn(() => chain);
  let activeCount: keyof typeof countValues = "emailIp";
  const chain = {
    eq,
    gt,
    gte,
    is,
    maybeSingle,
    order,
    then: (resolve: (value: { count: number; data: never[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ count: countValues[activeCount] ?? 0, data: [], error: null }).then(resolve, reject),
  };
  const from = vi.fn((table: string) => {
    if (table === "registration_attempts") {
      return {
        insert,
        select: vi.fn((columns: string) => {
          if (columns === "id") activeCount = "emailIp";
          if (columns === "id,email_normalized") activeCount = "ip";
          if (columns === "id,ip_address") activeCount = "domain";
          return chain;
        }),
      };
    }

    if (table === "registration_blocks") {
      return { select };
    }

      throw new Error(`Unexpected table: ${table}`);
  });

  return { eq, from, insert, is, maybeSingle, select };
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

  it("rate-limits repeated attempts for the same email and IP", async () => {
    const client = createRegisterLimitClient({ emailIp: 5 });

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 600,
    });
  });

  it("rate-limits high registration volume from the same IP", async () => {
    const client = createRegisterLimitClient({ emailIp: 0, ip: 20 });

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 600,
    });
  });

  it("rate-limits high registration volume for the same email domain", async () => {
    const client = createRegisterLimitClient({ domain: 50, emailIp: 0, ip: 0 });

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 600,
    });
  });

  it("blocks explicitly denied IPs, emails, and domains before recording another attempt", async () => {
    const client = createRegisterLimitClient({ domain: 0, emailIp: 0, ip: 0 }, {
      blocked_until: "2026-05-07T01:00:00.000Z",
      reason: "abuse",
    });

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 3600,
    });
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("only applies active blocks that have not been revoked", async () => {
    const client = createRegisterLimitClient({ domain: 0, emailIp: 0, ip: 0 }, null);

    await expect(checkRegisterRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-07T00:00:00.000Z"),
    })).resolves.toEqual({ ok: true });

    expect(client.is).toHaveBeenCalledWith("revoked_at", null);
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
