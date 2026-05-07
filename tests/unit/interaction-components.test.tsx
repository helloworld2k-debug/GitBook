import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders notice and error feedback toasts with accessible roles", () => {
    const { rerender } = render(<AdminFeedbackBanner notice="manual-donation-added" />);

    expect(screen.getByRole("status")).toHaveTextContent("Manual donation added.");
    expect(screen.getByRole("button", { name: "Dismiss feedback" })).toBeInTheDocument();

    rerender(<AdminFeedbackBanner error="manual-donation-failed" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to add manual donation.");
    expect(screen.getByRole("button", { name: "Dismiss feedback" })).toBeInTheDocument();
  });

  it("prioritizes error feedback over notice feedback", () => {
    render(<AdminFeedbackBanner error="manual-donation-failed" notice="manual-donation-added" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to add manual donation.");
    expect(screen.queryByText("Manual donation added.")).not.toBeInTheDocument();
  });

  it("does not render feedback for unknown keys", () => {
    render(<AdminFeedbackBanner notice="unknown-feedback-key" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("dismisses admin feedback toasts", () => {
    render(<AdminFeedbackBanner notice="manual-donation-added" />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss feedback" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("auto-dismisses success feedback while keeping errors visible", () => {
    vi.useFakeTimers();
    const { rerender } = render(<AdminFeedbackBanner notice="manual-donation-added" />);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<AdminFeedbackBanner error="manual-donation-failed" />);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

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
