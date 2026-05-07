import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocaleLayout from "@/app/[locale]/layout";

const nextIntlClientProviderMock = vi.hoisted(() =>
  vi.fn(({ children, messages }: { children: React.ReactNode; messages?: Record<string, unknown> | null }) => (
    <div data-message-count={Object.keys(messages ?? {}).length}>{children}</div>
  )),
);

vi.mock("next-intl", () => ({
  NextIntlClientProvider: nextIntlClientProviderMock,
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer>Site footer</footer>,
}));

describe("LocaleLayout", () => {
  it("wraps localized pages with global navigation and footer", async () => {
    render(await LocaleLayout({ children: <main>Page body</main> }));

    expect(screen.getByText("Site header")).toBeInTheDocument();
    expect(screen.getByText("Page body")).toBeInTheDocument();
    expect(screen.getByText("Site footer")).toBeInTheDocument();
    expect(nextIntlClientProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messages: null }),
      undefined,
    );
  });
});
