import { render, screen } from "@testing-library/react";

import { DonationTierCard } from "@/components/donation-tier-card";
import { donationTiers } from "@/config/site";

describe("DonationTierCard", () => {
  it("uses a service-neutral contribution checkout while Stripe is hidden", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Contribute now"
        isAuthenticated
        label="Monthly"
        loginHref="/en/login?next=%2Fen%2Fcontributions"
        loginLabel="Sign in to contribute"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Secure checkout with Dodo Payments for cards and supported local payment methods."
        tier={donationTiers[0]}
      />,
    );

    expect(screen.getByRole("button", { name: "Contribute now" })).toBeInTheDocument();
    expect(screen.getByText("Secure checkout with Dodo Payments for cards and supported local payment methods.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay with Stripe" })).not.toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/dodo"]')).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/stripe"]')).not.toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/paypal"]')).not.toBeInTheDocument();
  });

  it("does not expose legacy Stripe or PayPal checkout labels", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Contribute now"
        isAuthenticated
        label="Yearly"
        loginHref="/en/login?next=%2Fen%2Fcontributions"
        loginLabel="Sign in to contribute"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Secure checkout with Dodo Payments for cards and supported local payment methods."
        tier={donationTiers[2]}
      />,
    );

    expect(screen.queryByText(/stripe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/paypal/i)).not.toBeInTheDocument();
    expect(screen.getByText(/dodo payments/i)).toBeInTheDocument();
  });

  it("shows a sign-in link instead of a checkout form for anonymous users", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Contribute now"
        isAuthenticated={false}
        label="Monthly"
        loginHref="/en/login?next=%2Fen%2Fcontributions"
        loginLabel="Sign in to contribute"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Secure checkout with Dodo Payments for cards and supported local payment methods."
        tier={donationTiers[0]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Contribute now" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to contribute" })).toHaveAttribute(
      "href",
      "/en/login?next=%2Fen%2Fcontributions",
    );
    expect(document.querySelector('form[action="/api/checkout/dodo"]')).not.toBeInTheDocument();
  });

  it("shows the original price and discount for discounted tiers", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Contribute now"
        isAuthenticated
        label="Quarterly"
        loginHref="/en/login?next=%2Fen%2Fcontributions"
        loginLabel="Sign in to contribute"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Secure checkout with Dodo Payments for cards and supported local payment methods."
        tier={{ ...donationTiers[1], amount: 2430, compareAtAmount: 2700 }}
      />,
    );

    expect(screen.getByText("$24.30")).toBeInTheDocument();
    expect(screen.getByText("$27.00")).toBeInTheDocument();
    expect(screen.getByText("10% off")).toBeInTheDocument();
  });
});
