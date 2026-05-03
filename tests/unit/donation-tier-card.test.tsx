import { render, screen } from "@testing-library/react";

import { DonationTierCard } from "@/components/donation-tier-card";
import { donationTiers } from "@/config/site";

describe("DonationTierCard", () => {
  it("uses Dodo as the primary checkout while keeping Stripe available as a fallback", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Pay with Dodo Payments"
        checkoutStripeLabel="Pay with Stripe"
        label="Monthly"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Dodo is the recommended checkout."
        tier={donationTiers[0]}
      />,
    );

    expect(screen.getByRole("button", { name: "Pay with Dodo Payments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay with Stripe" })).toBeInTheDocument();
    expect(screen.getByText("Dodo is the recommended checkout.")).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/dodo"]')).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/paypal"]')).not.toBeInTheDocument();
  });
});
