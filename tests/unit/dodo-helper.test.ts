import { afterEach, describe, expect, it } from "vitest";
import { verifyDodoWebhook } from "@/lib/payments/dodo";

describe("Dodo payment helper", () => {
  afterEach(() => {
    delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  });

  it("requires Standard Webhooks headers before accepting an event", () => {
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = "whsec_test";

    expect(() => verifyDodoWebhook("{}", new Headers())).toThrow();
  });
});
