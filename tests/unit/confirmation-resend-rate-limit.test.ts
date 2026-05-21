import { describe, expect, it, vi } from "vitest";
import { checkConfirmationResendRateLimit } from "@/lib/auth/confirmation-resend-rate-limit";

function createResendLimitClient(counts: { emailDay?: number; emailMinute?: number; ipHour?: number }) {
  const insert = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(() => chain);
  const gte = vi.fn(() => chain);
  const is = vi.fn(() => chain);
  let activeCount: keyof typeof counts = "emailMinute";
  const chain = {
    eq,
    gte,
    is,
    then: (resolve: (value: { count: number | null; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ count: counts[activeCount] ?? 0, error: null }).then(resolve, reject),
  };
  const from = vi.fn((table: string) => {
    if (table !== "confirmation_resend_attempts") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      insert,
      select: vi.fn((columns: string) => {
        if (columns === "id,email_minute") activeCount = "emailMinute";
        if (columns === "id,email_day") activeCount = "emailDay";
        if (columns === "id,ip_hour") activeCount = "ipHour";
        return chain;
      }),
    };
  });

  return { from, insert, is };
}

describe("checkConfirmationResendRateLimit", () => {
  it("records resend attempts and allows normal traffic", async () => {
    const client = createResendLimitClient({});

    await expect(checkConfirmationResendRateLimit(client, {
      email: "New@Example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-19T00:00:00.000Z"),
      userAgent: "Vitest",
    })).resolves.toEqual({ ok: true });

    expect(client.insert).toHaveBeenCalledWith(expect.objectContaining({
      email_domain: "example.com",
      email_normalized: "new@example.com",
      ip_address: "203.0.113.10",
      user_agent: "Vitest",
    }));
  });

  it("enforces a 60 second per-email cooldown", async () => {
    const client = createResendLimitClient({ emailMinute: 2 });

    await expect(checkConfirmationResendRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-19T00:00:00.000Z"),
    })).resolves.toEqual({ ok: false, retryAfterSeconds: 60 });
    expect(client.insert).toHaveBeenCalled();
  });

  it("limits each email to five resend attempts per day", async () => {
    const client = createResendLimitClient({ emailDay: 6, emailMinute: 0 });

    await expect(checkConfirmationResendRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-19T00:00:00.000Z"),
    })).resolves.toEqual({ ok: false, retryAfterSeconds: 3600 });
  });

  it("limits each IP to ten resend attempts per hour", async () => {
    const client = createResendLimitClient({ emailDay: 0, emailMinute: 0, ipHour: 11 });

    await expect(checkConfirmationResendRateLimit(client, {
      email: "new@example.com",
      ip: "203.0.113.10",
      now: new Date("2026-05-19T00:00:00.000Z"),
    })).resolves.toEqual({ ok: false, retryAfterSeconds: 3600 });
  });

  it("uses null-safe IP queries when no IP is available", async () => {
    const client = createResendLimitClient({});

    await expect(checkConfirmationResendRateLimit(client, {
      email: "new@example.com",
      ip: null,
      now: new Date("2026-05-19T00:00:00.000Z"),
    })).resolves.toEqual({ ok: true });

    expect(client.is).toHaveBeenCalledWith("ip_address", null);
  });
});
