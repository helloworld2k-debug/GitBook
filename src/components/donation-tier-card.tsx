import type { donationTiers } from "@/config/site";

type Tier = (typeof donationTiers)[number];

type DonationTierCardProps = {
  checkoutPayPalLabel: string;
  checkoutStripeLabel: string;
  label: string;
  locale: string;
  oneTimeNote: string;
  tier: Tier;
};

export function DonationTierCard({
  checkoutPayPalLabel,
  checkoutStripeLabel,
  label,
  locale,
  oneTimeNote,
  tier,
}: DonationTierCardProps) {
  const amount = new Intl.NumberFormat(locale, {
    currency: tier.currency,
    style: "currency",
  }).format(tier.amount / 100);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-950">{label}</h2>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{amount}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{oneTimeNote}</p>
      <div className="mt-6 grid gap-2">
        <form action="/api/checkout/stripe" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <button
            className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            type="submit"
          >
            {checkoutStripeLabel}
          </button>
        </form>
        <form action="/api/checkout/paypal" method="post">
          <input type="hidden" name="tier" value={tier.code} />
          <button
            className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            type="submit"
          >
            {checkoutPayPalLabel}
          </button>
        </form>
      </div>
    </article>
  );
}
