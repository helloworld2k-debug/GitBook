import { describe, expect, it, vi } from "vitest";
import { checkLoginRisk, recordLoginAttempt } from "@/lib/auth/login-risk";

function createLoginRiskClient(counts: { email?: number; emailIp?: number; ip?: number }) {
  const insert = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(() => chain);
  const gte = vi.fn(() => chain);
  const is = vi.fn(() => chain);
  let activeCount: keyof typeof counts = "emailIp";
  const chain = {
    eq,
    gte,
    is,
    then: (resolve: (value: { count: number | null; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ count: counts[activeCount] ?? 0, error: null }).then(resolve, reject),
  };
  const from = vi.fn((table: string) => {
    if (table !== "login_attempts") throw new Error(`Unexpected table: ${table}`);

    return {
      insert,
      select: vi.fn((columns: string) => {
        if (columns === "id") activeCount = "emailIp";
        if (columns === "id,ip_address") activeCount = "email";
        if (columns === "id,email_normalized") activeCount = "ip";
        return chain;
      }),
    };
  });

  return { eq, from, insert, is };
}

describe("login risk", () => {
  it("allows normal sign-in attempts below the risk thresholds", async () => {
    const client = createLoginRiskClient({ email: 0, emailIp: 1, ip: 2 });

    await expect(checkLoginRisk(client, {
      email: " Friend@Example.com ",
      ip: "203.0.113.10",
      now: new Date("2026-05-12T08:00:00.000Z"),
    })).resolves.toEqual({ captchaRequired: false });
  });

  it("requires captcha after repeated failures for the same email and IP", async () => {
    const client = createLoginRiskClient({ emailIp: 5 });

    await expect(checkLoginRisk(client, {
      email: "friend@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-12T08:00:00.000Z"),
    })).resolves.toEqual({ captchaRequired: true });
  });

  it("requires captcha after high failed volume from the same IP", async () => {
    const client = createLoginRiskClient({ email: 0, emailIp: 0, ip: 20 });

    await expect(checkLoginRisk(client, {
      email: "friend@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-12T08:00:00.000Z"),
    })).resolves.toEqual({ captchaRequired: true });
  });

  it("requires captcha after repeated failures for the same email across IPs", async () => {
    const client = createLoginRiskClient({ email: 10, emailIp: 0, ip: 0 });

    await expect(checkLoginRisk(client, {
      email: "friend@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-12T08:00:00.000Z"),
    })).resolves.toEqual({ captchaRequired: true });
  });

  it("records successful and failed login attempts without storing passwords", async () => {
    const client = createLoginRiskClient({});

    await recordLoginAttempt(client, {
      email: " Friend@Example.com ",
      ip: "203.0.113.10",
      result: "failure",
      userAgent: "Vitest",
    });

    expect(client.insert).toHaveBeenCalledWith({
      email_domain: "example.com",
      email_normalized: "friend@example.com",
      ip_address: "203.0.113.10",
      result: "failure",
      user_agent: "Vitest",
    });
  });
});
