import type { donationTiers } from "@/config/site";

type Tier = (typeof donationTiers)[number];

type DonationTierCardProps = {
  checkoutStripeLabel: string;
  label: string;
  locale: string;
  oneTimeNote: string;
  payPalUnavailableNote: string;
  tier: Tier;
};

export function DonationTierCard({
  checkoutStripeLabel,
  label,
  locale,
  oneTimeNote,
  payPalUnavailableNote,
  tier,
}: DonationTierCardProps) {
  const amount = new Intl.NumberFormat(locale, {
    currency: tier.currency,
    style: "currency",
  }).format(tier.amount / 100);

  return (
    <article className="glass-panel rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white">{label}</h2>
      <p className="mt-3 text-3xl font-semibold text-cyan-100">{amount}</p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{oneTimeNote}</p>
      <div className="mt-6 grid gap-2">
        <form action="/api/checkout/stripe" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <button
            className="neon-button flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            type="submit"
          >
            {checkoutStripeLabel}
          </button>
        </form>
        <p className="rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-100">
          {payPalUnavailableNote}
        </p>
      </div>
    </article>
  );
}
