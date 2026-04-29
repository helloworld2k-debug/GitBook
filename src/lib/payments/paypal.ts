type PayPalConfig = {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
};

type PayPalLink = {
  href: string;
  rel: string;
};

type CreatePayPalOrderInput = {
  amount: string;
  cancelUrl: string;
  currency: string;
  returnUrl: string;
  tierCode: string;
  userId: string;
};

type PayPalOrder = {
  id: string;
  links: PayPalLink[];
};

export function getPayPalConfig(): PayPalConfig {
  return {
    baseUrl: process.env.PAYPAL_BASE_URL ?? "https://api-m.paypal.com",
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  };
}

export async function getPayPalAccessToken() {
  const { baseUrl, clientId, clientSecret } = getPayPalConfig();

  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal client credentials.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token.");
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("PayPal access token response was missing access_token.");
  }

  return data.access_token;
}

export async function createPayPalOrder(input: CreatePayPalOrderInput): Promise<PayPalOrder> {
  const { baseUrl } = getPayPalConfig();
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: input.currency,
            value: input.amount,
          },
          custom_id: JSON.stringify({ userId: input.userId, tierCode: input.tierCode }),
        },
      ],
      application_context: {
        cancel_url: input.cancelUrl,
        return_url: input.returnUrl,
      },
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to create PayPal order.");
  }

  return (await response.json()) as PayPalOrder;
}

export async function capturePayPalOrder(orderId: string) {
  const { baseUrl } = getPayPalConfig();
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to capture PayPal order.");
  }

  return response.json();
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const { baseUrl, webhookId } = getPayPalConfig();

  if (!webhookId) {
    throw new Error("Missing PayPal webhook ID.");
  }

  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_event: event,
      webhook_id: webhookId,
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { verification_status?: string };

  return data.verification_status === "SUCCESS";
}
