import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocaleLayout from "@/app/[locale]/layout";

const nextIntlClientProviderMock = vi.hoisted(() =>
  vi.fn(({ children, messages }: { children: React.ReactNode; messages?: Record<string, unknown> | null }) => (
    <div data-message-count={Object.keys(messages ?? {}).length}>{children}</div>
  )),
);
const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  NextIntlClientProvider: nextIntlClientProviderMock,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer>Site footer</footer>,
}));

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "ja", "ko", "zh-Hant"],
  },
}));

describe("LocaleLayout", () => {
  beforeEach(() => {
    nextIntlClientProviderMock.mockClear();
    usePathnameMock.mockReset().mockReturnValue("/en");
  });

  it("wraps localized pages with global navigation and footer", async () => {
    render(await LocaleLayout({ children: <main>Page body</main>, params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByText("Site header")).toBeInTheDocument();
    expect(screen.getByText("Page body")).toBeInTheDocument();
    expect(screen.getByText("Site footer")).toBeInTheDocument();
    expect(nextIntlClientProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messages: null }),
      undefined,
    );
  });

  it("hides public navigation and footer for admin pages", async () => {
    usePathnameMock.mockReturnValue("/en/admin/users");

    render(await LocaleLayout({ children: <main>Admin body</main>, params: Promise.resolve({ locale: "en" }) }));

    expect(screen.queryByText("Site header")).not.toBeInTheDocument();
    expect(screen.getByText("Admin body")).toBeInTheDocument();
    expect(screen.queryByText("Site footer")).not.toBeInTheDocument();
  });

  it("sets the html lang attribute from the locale param", async () => {
    render(await LocaleLayout({ children: <main>Japanese page</main>, params: Promise.resolve({ locale: "ja" }) }));

    const html = document.querySelector("html");
    expect(html?.getAttribute("lang")).toBe("ja");
  });
});
