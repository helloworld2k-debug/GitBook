import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupportFeedbackTableRow } from "@/app/[locale]/admin/support-feedback/support-feedback-table-row";

vi.mock("@/app/[locale]/admin/actions", () => ({
  updateSupportFeedbackStatus: vi.fn(),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={`/en${href}`} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div>Language</div>,
}));

vi.mock("@/components/admin/support-feedback-status-form", () => ({
  SupportFeedbackStatusForm: ({
    children,
    labels,
  }: {
    children: React.ReactNode;
    labels: { save: string };
  }) => (
    <form>
      {children}
      <button type="submit">{labels.save}</button>
    </form>
  ),
}));

describe("SupportFeedbackTableRow", () => {
  it("renders synchronously with labels supplied by the server page", () => {
    const row = SupportFeedbackTableRow({
      contact: "telegram",
      createdAt: "May 1, 2026, 10:00:00 UTC",
      email: "ada@example.com",
      feedbackId: "feedback-1",
      initialStatus: "open",
      isUnread: true,
      labels: {
        closed: "Closed",
        confirmChange: "Change from {old} to {new}?",
        open: "Open",
        reviewing: "Reviewing",
        save: "Save",
        saving: "Saving...",
        unread: "Unread",
        view: "Open thread",
      },
      locale: "en",
      message: "The support page failed.",
      subject: "Need help",
    });

    expect(row).not.toHaveProperty("then");

    render(
      <table>
        <tbody>{row}</tbody>
      </table>,
    );

    expect(screen.getByText("Need help")).toBeInTheDocument();
    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open thread" })).toHaveAttribute("href", "/en/admin/support-feedback/feedback-1");
  });
});
