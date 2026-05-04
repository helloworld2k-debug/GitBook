import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminFeedbackBanner } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";

const pendingState = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");

  return {
    ...actual,
    useFormStatus: () => pendingState,
  };
});

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div>Language</div>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
}));

describe("interaction components", () => {
  it("renders notice and error feedback banners with accessible roles", () => {
    const { rerender } = render(<AdminFeedbackBanner notice="manual-donation-added" />);

    expect(screen.getByRole("status")).toHaveTextContent("Manual donation added.");

    rerender(<AdminFeedbackBanner error="manual-donation-failed" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to add manual donation.");
  });

  it("disables submit buttons and swaps the label while pending", () => {
    pendingState.pending = true;

    render(
      <AdminSubmitButton pendingLabel="Processing request">
        Save
      </AdminSubmitButton>,
    );

    const button = screen.getByRole("button", { name: "Processing request" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    pendingState.pending = false;
  });

  it("requires an explicit second click before dangerous actions submit", () => {
    render(
      <ConfirmActionButton confirmLabel="Confirm revoke" pendingLabel="Revoking">
        Revoke certificate
      </ConfirmActionButton>,
    );

    const button = screen.getByRole("button", { name: "Revoke certificate" });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Confirm revoke" })).toBeInTheDocument();
    expect(screen.getByText("Click again to confirm this action.")).toBeInTheDocument();
  });
});
