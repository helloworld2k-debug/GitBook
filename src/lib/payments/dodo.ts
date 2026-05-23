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

export type DodoPaymentEnvironment = "test" | "live";

export type PaymentProductSettingsClient = {
  from: (table: "payment_product_settings") => {
    select: (columns: string) => {
      eq: (column: string, value: string | boolean) => PaymentProductSettingsFilter;
    };
  };
};

type PaymentProductSettingsFilter = {
  eq: (column: string, value: string | boolean) => PaymentProductSettingsFilter;
  maybeSingle: () => PromiseLike<{ data: PaymentProductSettingsRow | null; error: unknown }>;
};

type PaymentProductSettingsRow = {
  product_id: string | null;
};

function getDodoEnvironment(environment = process.env.DODO_PAYMENTS_ENV): DodoPaymentEnvironment {
  return environment === "live" ? "live" : "test";
}

function readRequiredEnv(name: string, description: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it to ${description}.`);
  }

  return value;
}

export function getDodoApiBaseUrl() {
  return getDodoEnvironment() === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

function getDodoProductEnvName(tierCode: string, environment: DodoPaymentEnvironment) {
  const envByTier: Record<string, string> = {
    monthly: "DODO_PRODUCT_MONTHLY",
    quarterly: "DODO_PRODUCT_QUARTERLY",
    yearly: "DODO_PRODUCT_YEARLY",
  };
  const liveEnvByTier: Record<string, string> = {
    monthly: "DODO_LIVE_PRODUCT_MONTHLY",
    quarterly: "DODO_LIVE_PRODUCT_QUARTERLY",
    yearly: "DODO_LIVE_PRODUCT_YEARLY",
  };

  return environment === "live" ? (liveEnvByTier[tierCode] ?? envByTier[tierCode]) : envByTier[tierCode];
}

function readOptionalEnv(name: string | undefined) {
  if (!name) {
    return null;
  }

  return process.env[name] || null;
}

async function readPaymentProductSetting(
  client: PaymentProductSettingsClient | undefined,
  tierCode: string,
  environment: DodoPaymentEnvironment,
) {
  if (!client) {
    return null;
  }

  try {
    const query = client
      .from("payment_product_settings")
      .select("product_id")
      .eq("provider", "dodo")
      .eq("environment", environment)
      .eq("tier_code", tierCode)
      .eq("is_enabled", true);
    const { data } = await query.maybeSingle();

    return data?.product_id || null;
  } catch {
    return null;
  }
}

export async function getDodoProductId(
  tierCode: string,
  options: { client?: PaymentProductSettingsClient; environment?: DodoPaymentEnvironment } = {},
) {
  const environment = options.environment ?? getDodoEnvironment();
  const configuredProductId = await readPaymentProductSetting(options.client, tierCode, environment);

  if (configuredProductId) {
    return configuredProductId;
  }

  const envName = getDodoProductEnvName(tierCode, environment);

  if (!envName) {
    return null;
  }

  return readOptionalEnv(envName) ?? (environment === "live" ? readOptionalEnv(getDodoProductEnvName(tierCode, "test")) : null);
}

export function getRequiredDodoProductId(tierCode: string) {
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
