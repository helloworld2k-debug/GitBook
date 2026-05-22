/**
 * Payment webhook integration tests
 * Tests that payment success triggers certificate and entitlement generation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { Webhook } from "standardwebhooks";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dodoWebhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY!;

describe("Payment Webhook", () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const testUserId = randomUUID();
  let testDonationId: string;

  beforeAll(async () => {
    // Create test user
    const { error: userError } = await supabase.auth.admin.createUser({
      id: testUserId,
      email: `test-${testUserId}@example.com`,
      email_confirm: true,
    });

    if (userError) {
      throw new Error(`Failed to create test user: ${userError.message}`);
    }
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from("certificates").delete().eq("user_id", testUserId);
    await supabase.from("license_entitlements").delete().eq("user_id", testUserId);
    await supabase.from("license_entitlement_grants").delete().eq("user_id", testUserId);
    await supabase.from("donations").delete().eq("user_id", testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
  });

  it("should generate certificate and entitlement on payment success", async () => {
    const paymentId = `test_${randomUUID()}`;
    const timestamp = new Date().toISOString();

    // Create webhook payload
    const payload = {
      type: "payment.succeeded",
      data: {
        id: paymentId,
        payment_id: paymentId,
        total_amount: 1000, // $10.00 in cents
        currency: "usd",
        created_at: timestamp,
        product_cart: [
          {
            product_id: process.env.DODO_PRODUCT_MONTHLY!,
            quantity: 1,
          },
        ],
        metadata: {
          user_id: testUserId,
          tier: "monthly",
          amount: "1000",
        },
      },
    };

    // Sign webhook
    const webhook = new Webhook(dodoWebhookKey);
    const signature = webhook.sign(JSON.stringify(payload));
    const headers = {
      "webhook-id": randomUUID(),
      "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
      "webhook-signature": signature,
    };

    // Call webhook endpoint
    const response = await fetch("http://localhost:3000/api/webhooks/dodo", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    expect(response.ok).toBe(true);

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify donation was created
    const { data: donation } = await supabase
      .from("donations")
      .select("*")
      .eq("provider_transaction_id", paymentId)
      .single();

    expect(donation).toBeTruthy();
    expect(donation?.status).toBe("paid");
    expect(donation?.user_id).toBe(testUserId);
    testDonationId = donation!.id;

    // Verify certificate was generated
    const { data: certificate } = await supabase
      .from("certificates")
      .select("*")
      .eq("donation_id", testDonationId)
      .eq("type", "donation")
      .single();

    expect(certificate).toBeTruthy();
    expect(certificate?.user_id).toBe(testUserId);
    expect(certificate?.status).toBe("active");

    // Verify cloud sync entitlement was granted
    const { data: entitlement } = await supabase
      .from("license_entitlements")
      .select("*")
      .eq("user_id", testUserId)
      .eq("feature_code", "cloud_sync")
      .eq("status", "active")
      .single();

    expect(entitlement).toBeTruthy();
    expect(entitlement?.source_donation_id).toBe(testDonationId);

    // Verify entitlement is in the future
    const validUntil = new Date(entitlement!.valid_until);
    const now = new Date();
    expect(validUntil.getTime()).toBeGreaterThan(now.getTime());
  });

  it("should handle duplicate webhook calls idempotently", async () => {
    const paymentId = `test_duplicate_${randomUUID()}`;
    const payload = {
      type: "payment.succeeded",
      data: {
        id: paymentId,
        payment_id: paymentId,
        total_amount: 1000,
        currency: "usd",
        created_at: new Date().toISOString(),
        product_cart: [
          {
            product_id: process.env.DODO_PRODUCT_MONTHLY!,
            quantity: 1,
          },
        ],
        metadata: {
          user_id: testUserId,
          tier: "monthly",
          amount: "1000",
        },
      },
    };

    const webhook = new Webhook(dodoWebhookKey);
    const signature = webhook.sign(JSON.stringify(payload));
    const headers = {
      "webhook-id": randomUUID(),
      "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
      "webhook-signature": signature,
    };

    // Call webhook twice
    await fetch("http://localhost:3000/api/webhooks/dodo", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });

    await fetch("http://localhost:3000/api/webhooks/dodo", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify only one donation was created (upsert on conflict)
    const { count } = await supabase
      .from("donations")
      .select("*", { count: "exact", head: true })
      .eq("provider_transaction_id", paymentId);

    expect(count).toBe(1);
  });

  it("should reject invalid webhook signatures", async () => {
    const response = await fetch("http://localhost:3000/api/webhooks/dodo", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": randomUUID(),
        "webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
        "webhook-signature": "invalid",
      },
      body: JSON.stringify({ type: "payment.succeeded" }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });
});
