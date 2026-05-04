import { render, screen } from "@testing-library/react";

import { DonationTierCard } from "@/components/donation-tier-card";
import { donationTiers } from "@/config/site";

describe("DonationTierCard", () => {
  it("uses a service-neutral contribution checkout while Stripe is hidden", () => {
    render(
      <DonationTierCard
        checkoutDodoLabel="Contribute now"
        label="Monthly"
        locale="en"
        oneTimeNote="One-time support"
        paymentNote="Secure checkout for cards and supported local payment methods."
        tier={donationTiers[0]}
      />,
    );

    expect(screen.getByRole("button", { name: "Contribute now" })).toBeInTheDocument();
    expect(screen.queryByText(/Dodo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay with Stripe" })).not.toBeInTheDocument();
    expect(screen.getByText("Secure checkout for cards and supported local payment methods.")).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/dodo"]')).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/stripe"]')).not.toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/paypal"]')).not.toBeInTheDocument();
  });
});
