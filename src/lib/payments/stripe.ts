import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function readRequiredEnv(name: string, description: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it to ${description}.`);
  }

  return value;
}

export function getStripe() {
  stripeClient ??= new Stripe(readRequiredEnv("STRIPE_SECRET_KEY", "your Stripe secret key"), {
    // @ts-expect-error stripe-node types only accept the SDK's latest API version.
    apiVersion: "2025-03-31.basil",
  });

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, property, receiver) {
    return Reflect.get(getStripe(), property, receiver);
  },
});

export function getStripeWebhookSecret() {
  return readRequiredEnv("STRIPE_WEBHOOK_SECRET", "your Stripe webhook signing secret");
}
