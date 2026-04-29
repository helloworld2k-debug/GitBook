import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyPayPalWebhook } from "@/lib/payments/paypal";
import { findDonationTier } from "@/lib/payments/tier";

export const runtime = "nodejs";

type PayPalWebhookEvent = {
  event_type?: string;
  resource?: {
    custom_id?: unknown;
    id?: unknown;
  };
};

function parseCustomId(customId: unknown): { tierCode: string; userId: string } | null {
  if (typeof customId !== "string") {
    return null;
  }

  try {
    const metadata = JSON.parse(customId) as { tierCode?: unknown; userId?: unknown };

    if (typeof metadata.userId !== "string" || typeof metadata.tierCode !== "string") {
      return null;
    }

    return {
      tierCode: metadata.tierCode,
      userId: metadata.userId,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const event = (await request.json()) as PayPalWebhookEvent;
  const isValid = await verifyPayPalWebhook(await headers(), event);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid PayPal webhook signature" }, { status: 400 });
  }

  if (event.event_type === "CHECKOUT.ORDER.APPROVED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const metadata = parseCustomId(event.resource?.custom_id);
    const donationTier = findDonationTier(metadata?.tierCode ?? null);

    if (typeof event.resource?.id !== "string" || !metadata?.userId || !donationTier) {
      return NextResponse.json({ error: "Missing required metadata" }, { status: 400 });
    }
  }

  return NextResponse.json({ received: true });
}
