import type { donationTiers } from "@/config/site";

type Tier = (typeof donationTiers)[number];

type DonationTierCardProps = {
  checkoutDodoLabel: string;
  checkoutStripeLabel: string;
  label: string;
  locale: string;
  oneTimeNote: string;
  paymentNote: string;
  tier: Tier;
};

export function DonationTierCard({
  checkoutDodoLabel,
  checkoutStripeLabel,
  label,
  locale,
  oneTimeNote,
  paymentNote,
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
        <form action="/api/checkout/dodo" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <input type="hidden" name="locale" value={locale} />
          <button
            className="neon-button flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            type="submit"
          >
            {checkoutDodoLabel}
          </button>
        </form>
        <form action="/api/checkout/stripe" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <input type="hidden" name="locale" value={locale} />
          <button
            className="flex min-h-10 w-full cursor-pointer items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition-all hover:border-cyan-200/60 hover:bg-cyan-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            type="submit"
          >
            {checkoutStripeLabel}
          </button>
        </form>
        <p className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-100">
          {paymentNote}
        </p>
      </div>
    </article>
  );
}
