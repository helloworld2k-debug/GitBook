import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/site-footer";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const tables: Record<string, Record<string, string>> = {
      footer: {
        tagline: "AI coding knowledge, downloads, and support in one place.",
        status: "Secure downloads and account support",
        availability: "macOS and Windows releases",
        contact: "Support follows signed-in feedback threads",
        copyright: "Independent software support site.",
      },
    };

    return (key: string) => tables[namespace]?.[key] ?? key;
  }),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("SiteFooter", () => {
  it("renders only the logo and copyright without navigation links", async () => {
    render(await SiteFooter());

    expect(screen.getByRole("contentinfo")).toHaveTextContent("GitBook AI");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Independent software support site.");
    expect(screen.queryByText("AI coding knowledge, downloads, and support in one place.")).not.toBeInTheDocument();
    expect(screen.queryByText("Secure downloads and account support")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
