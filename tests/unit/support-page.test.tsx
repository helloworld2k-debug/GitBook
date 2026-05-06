import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupportPage, { dynamic } from "@/app/[locale]/support/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getDefaultSupportChannelsConfig: vi.fn(),
  normalizeSupportChannels: vi.fn(),
  submitSupportFeedback: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>GitBook AI</header>,
}));

vi.mock("@/config/support", () => ({
  getDefaultSupportChannelsConfig: (...args: unknown[]) => mocks.getDefaultSupportChannelsConfig(...args),
  normalizeSupportChannels: (...args: unknown[]) => mocks.normalizeSupportChannels(...args),
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
      signInToSubmit: "Sign in to send feedback",
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
  it("uses dynamic rendering because feedback visibility depends on auth cookies", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("shows a disabled feedback form and sign-in CTA for logged-out users", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
      }),
    }));
    mocks.getDefaultSupportChannelsConfig.mockReturnValue({
      discord: "",
      email: "",
      qq: "",
      telegram: "",
      wechat: "",
    });
    mocks.normalizeSupportChannels.mockReturnValue([
      { href: "mailto:support@example.com", icon: () => null, id: "email", label: "Email", value: "support@example.com" },
    ]);
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
      from,
    });

    render(
      await SupportPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("link", { name: "Sign in to send feedback" })).toHaveAttribute("href", "/login?next=%2Fen%2Fsupport");
    expect(screen.getByLabelText("Preferred contact")).toBeDisabled();
    expect(screen.getByLabelText("Subject")).toBeDisabled();
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Email support@example.com" })).toHaveAttribute("href", "mailto:support@example.com");
    expect(screen.queryByRole("heading", { name: "My feedback" })).not.toBeInTheDocument();
    expect(from).toHaveBeenCalledWith("support_contact_channels");
    expect(from).not.toHaveBeenCalledWith("support_feedback");
  });

  it("renders a success banner and a Dodo checkout expectation style form state for signed-in users", async () => {
    mocks.getDefaultSupportChannelsConfig.mockReturnValue({
      discord: "",
      email: "",
      qq: "",
      telegram: "",
      wechat: "",
    });
    mocks.normalizeSupportChannels.mockReturnValue([]);
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1", email: "ada@example.com" } } }),
      },
      from: (table: string) => {
        if (table === "support_contact_channels") {
          return {
            select: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          };
        }

        if (table === "support_feedback") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    render(
      await SupportPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ feedback: "saved" }),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Feedback sent. We will review it soon.");
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeInTheDocument();
    expect(screen.getByLabelText("Preferred contact")).not.toBeDisabled();
  });
});
