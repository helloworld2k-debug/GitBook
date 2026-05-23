export type PaymentCheckoutStatusClient = {
  from: (table: "operational_settings") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: { value: unknown } | null; error: unknown }>;
      };
    };
  };
};

export type PaymentCheckoutStatus = {
  isPaused: boolean;
  message: string | null;
};

export const defaultPaymentMaintenanceMessage = "Checkout is temporarily paused while we investigate a payment issue. Existing payments will continue to be processed.";

function readStatusValue(value: unknown): PaymentCheckoutStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { isPaused: false, message: null };
  }

  const data = value as Record<string, unknown>;
  const isPaused = data.is_paused === true;
  const message = typeof data.message === "string" && data.message.trim() ? data.message.trim() : null;

  return { isPaused, message };
}

export async function getPaymentCheckoutStatus(client?: PaymentCheckoutStatusClient | null): Promise<PaymentCheckoutStatus> {
  if (!client) {
    return { isPaused: false, message: null };
  }

  try {
    const { data } = await client
      .from("operational_settings")
      .select("value")
      .eq("key", "payment_checkout")
      .maybeSingle();

    return readStatusValue(data?.value);
  } catch {
    return { isPaused: false, message: null };
  }
}
