import { render, screen } from "@testing-library/react";

import { DonationTierCard } from "@/components/donation-tier-card";
import { donationTiers } from "@/config/site";

describe("DonationTierCard", () => {
  it("keeps PayPal checkout unavailable until donation persistence is complete", () => {
    render(
      <DonationTierCard
        checkoutStripeLabel="Pay with Stripe"
        label="Monthly"
        locale="en"
        oneTimeNote="One-time support"
        payPalUnavailableNote="PayPal is not enabled yet."
        tier={donationTiers[0]}
      />,
    );

    expect(screen.getByRole("button", { name: "Pay with Stripe" })).toBeInTheDocument();
    expect(screen.getByText("PayPal is not enabled yet.")).toBeInTheDocument();
    expect(document.querySelector('form[action="/api/checkout/paypal"]')).not.toBeInTheDocument();
  });
});
