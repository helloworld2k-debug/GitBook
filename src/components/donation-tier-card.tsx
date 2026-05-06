import type { DonationTier } from "@/lib/payments/tier";

type DonationTierCardProps = {
  checkoutDodoLabel: string;
  isAuthenticated: boolean;
  label: string;
  loginHref: string;
  loginLabel: string;
  locale: string;
  oneTimeNote: string;
  paymentNote: string;
  tier: DonationTier;
};

export function DonationTierCard({
  checkoutDodoLabel,
  isAuthenticated,
  label,
  loginHref,
  loginLabel,
  locale,
  oneTimeNote,
  paymentNote,
  tier,
}: DonationTierCardProps) {
  const amount = new Intl.NumberFormat(locale, {
    currency: tier.currency,
    style: "currency",
  }).format(tier.amount / 100);
  const compareAtAmount =
    tier.compareAtAmount && tier.compareAtAmount > tier.amount
      ? new Intl.NumberFormat(locale, {
          currency: tier.currency,
          style: "currency",
        }).format(tier.compareAtAmount / 100)
      : null;
  const discountPercent = tier.compareAtAmount && tier.compareAtAmount > tier.amount
    ? Math.round((1 - tier.amount / tier.compareAtAmount) * 100)
    : null;

  return (
    <article className="glass-panel rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white">{label}</h2>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <p className="text-3xl font-semibold text-cyan-100">{amount}</p>
        {compareAtAmount ? (
          <p className="text-sm font-medium text-slate-400 line-through">{compareAtAmount}</p>
        ) : null}
        {discountPercent ? (
          <p className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-semibold text-emerald-100">
            {discountPercent}% off
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{oneTimeNote}</p>
      <div className="mt-6 grid gap-2">
        {isAuthenticated ? (
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
        ) : (
          <a
            className="neon-button flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            href={loginHref}
          >
            {loginLabel}
          </a>
        )}
        <p className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-100">
          {paymentNote}
        </p>
      </div>
    </article>
  );
}
