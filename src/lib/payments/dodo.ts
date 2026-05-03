import { Webhook } from "standardwebhooks";

type DodoCheckoutPayload = {
  cancel_url?: string;
  customer?: {
    email?: string;
  };
  feature_flags?: {
    redirect_immediately?: boolean;
  };
  metadata: Record<string, string>;
  payment_link: boolean;
  product_cart: Array<{
    product_id: string;
    quantity: number;
  }>;
  return_url: string;
};

export type DodoWebhookEvent = {
  type: string;
  data?: unknown;
};

function readRequiredEnv(name: string, description: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it to ${description}.`);
  }

  return value;
}

export function getDodoApiBaseUrl() {
  return process.env.DODO_PAYMENTS_ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

export function getDodoProductId(tierCode: string) {
  const envByTier: Record<string, string> = {
    monthly: "DODO_PRODUCT_MONTHLY",
    quarterly: "DODO_PRODUCT_QUARTERLY",
    yearly: "DODO_PRODUCT_YEARLY",
  };
  const envName = envByTier[tierCode];

  if (!envName) {
    return null;
  }

  return readRequiredEnv(envName, `your Dodo product id for ${tierCode}`);
}

export async function createDodoCheckoutSession(payload: DodoCheckoutPayload) {
  const response = await fetch(`${getDodoApiBaseUrl()}/checkouts`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${readRequiredEnv("DODO_PAYMENTS_API_KEY", "your Dodo Payments API key")}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to create Dodo checkout session.");
  }

  return (await response.json()) as { checkout_url?: string };
}

export function verifyDodoWebhook(body: string, headers: Headers): DodoWebhookEvent {
  const secret = readRequiredEnv("DODO_PAYMENTS_WEBHOOK_KEY", "your Dodo Payments webhook secret");
  const event = new Webhook(secret).verify(body, {
    "webhook-id": headers.get("webhook-id") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
  });

  return event as DodoWebhookEvent;
}
