type Provider = "stripe" | "paypal" | "manual";

export type ProviderDonationInput = {
  userId: string;
  tierCode: string;
  amount: number;
  currency: string;
  provider: Provider;
  providerTransactionId: string;
  paidAt?: Date | string;
};

export function buildDonationRecord(input: ProviderDonationInput) {
  const paidAt = input.paidAt instanceof Date ? input.paidAt.toISOString() : (input.paidAt ?? new Date().toISOString());

  return {
    user_id: input.userId,
    amount: input.amount,
    currency: input.currency,
    provider: input.provider,
    provider_transaction_id: input.providerTransactionId,
    status: "paid" as const,
    paid_at: paidAt,
    metadata: { tier: input.tierCode },
  };
}
