import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminExportButton } from "@/components/admin/admin-export-button";
import { AdminFeedbackBanner } from "@/components/admin/admin-shell";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { CertificateShareButton } from "@/components/certificate-share-button";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { FormStatusBanner } from "@/components/form-status-banner";
import { FormSubmitButton } from "@/components/form-submit-button";

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
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:csv"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    pendingState.pending = false;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("announces form status banners through live regions", () => {
    const { rerender } = render(<FormStatusBanner message="Saved changes" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent("Saved changes");

    rerender(<FormStatusBanner message="Unable to save" tone="error" />);

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to save");
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

  it("clears admin feedback query params when dismissed", () => {
    window.history.pushState({}, "", "/admin/contribution-pricing?channel=live-monthly&error=payment-product-update-failed&notice=payment-product-updated");

    render(<AdminFeedbackBanner error="payment-product-update-failed" />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss feedback" }));

    expect(window.location.search).toBe("?channel=live-monthly");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    expect(screen.getByRole("status")).toHaveTextContent("Processing request");

    pendingState.pending = false;
  });

  it("announces public form submit progress while pending", () => {
    pendingState.pending = true;

    render(
      <FormSubmitButton pendingLabel="Sending feedback">
        Send feedback
      </FormSubmitButton>,
    );

    expect(screen.getByRole("button", { name: "Sending feedback" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sending feedback");

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
    expect(screen.getByRole("status")).toHaveTextContent("Click again to confirm this action.");
  });

  it("announces CSV export completion", async () => {
    render(
      <AdminExportButton
        data={[{ email: "friend@example.com" }]}
        filename="users"
        labels={{ export: "Export users", exporting: "Exporting users" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export users" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Export complete.");
  });

  it("announces share completion when the native share sheet resolves", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });

    render(
      <CertificateShareButton
        certificateNumber="CERT-001"
        certificateUrl="https://example.com/cert"
        labels={{ copyLink: "Copy link", share: "Share", shared: "Shared" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(share).toHaveBeenCalled();
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Shared");
  });

  it("announces share failures instead of silently swallowing them", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("share failed")),
    });

    render(
      <CertificateShareButton
        certificateNumber="CERT-001"
        certificateUrl="https://example.com/cert"
        labels={{ copyLink: "Copy link", share: "Share", shared: "Shared" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to share.");
  });
});
