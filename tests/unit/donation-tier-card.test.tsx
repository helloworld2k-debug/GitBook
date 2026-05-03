import { render, screen } from "@testing-library/react";

import { DonationTierCard } from "@/components/donation-tier-card";
import { donationTiers } from "@/config/site";

describe("DonationTierCard", () => {
  it("uses Dodo as the only visible checkout while Stripe is hidden", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Pay with Dodo Payments"
        label="Monthly"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Dodo is the recommended checkout."
        tier={donationTiers[0]}
      />,
    );

    expect(screen.getByRole("button", { name: "Pay with Dodo Payments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay with Stripe" })).not.toBeInTheDocument();
    expect(screen.getByText("Dodo is the recommended checkout.")).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/dodo"]')).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/stripe"]')).not.toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/paypal"]')).not.toBeInTheDocument();
  });
});
