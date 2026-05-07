import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/site-footer";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const tables: Record<string, Record<string, string>> = {
      footer: {
        tagline: "AI coding knowledge, downloads, and support in one place.",
        product: "Product",
        account: "Account",
        resources: "Resources",
        copyright: "Independent software support site.",
      },
      nav: {
        dashboard: "Dashboard",
        donate: "Contributions",
        download: "Download",
        notifications: "Notifications",
        support: "Support",
      },
      home: {
        olderVersions: "Older versions",
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
  it("renders footer content and related site links", async () => {
    render(await SiteFooter());

    expect(screen.getByRole("contentinfo")).toHaveTextContent("AI coding knowledge, downloads, and support in one place.");
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Older versions" })).toHaveAttribute("href", "/versions");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
  });
});
