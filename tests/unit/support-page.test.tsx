import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupportPage from "@/app/[locale]/support/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  submitSupportFeedback: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>GitBook AI</header>,
}));

vi.mock("@/config/support", () => ({
  getVisibleSupportChannels: () => [],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/app/[locale]/support/actions", () => ({
  submitSupportFeedback: mocks.submitSupportFeedback,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      eyebrow: "Support",
      title: "Help and feedback",
      subtitle: "Use support channels or send account issue details.",
      channelsTitle: "Chat channels",
      channelsEmpty: "No chat channels are configured yet.",
      formTitle: "Submit account feedback",
      success: "Feedback sent. We will review it soon.",
      error: "Could not send feedback. Please try again.",
      contact: "Preferred contact",
      subject: "Subject",
      message: "Message",
      submit: "Send feedback",
      signInRequiredTitle: "Sign in to submit feedback",
      signInRequiredDescription: "Feedback is tied to your account.",
      signInToSubmit: "Sign in",
      myFeedbackTitle: "My feedback",
      myFeedbackEmpty: "No feedback threads yet.",
      viewThread: "View thread",
      "statuses.open": "Open",
    };

    return messages[key] ?? key;
  }),
  setRequestLocale: vi.fn(),
}));

describe("SupportPage", () => {
  it("renders a success banner and a Dodo checkout expectation style form state for signed-in users", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1", email: "ada@example.com" } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    render(
      await SupportPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ feedback: "saved" }),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Feedback sent. We will review it soon.");
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeInTheDocument();
  });
});
