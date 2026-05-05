import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocaleLayout from "@/app/[locale]/layout";

const getMessagesMock = vi.hoisted(() => vi.fn());
const nextIntlClientProviderMock = vi.hoisted(() =>
  vi.fn(({ children, messages }: { children: React.ReactNode; messages?: Record<string, unknown> }) => (
    <div data-message-count={Object.keys(messages ?? {}).length}>{children}</div>
  )),
);

vi.mock("next-intl", () => ({
  NextIntlClientProvider: nextIntlClientProviderMock,
}));

vi.mock("next-intl/server", () => ({
  getMessages: getMessagesMock,
}));

describe("LocaleLayout", () => {
  it("does not ship full locale message bundles to every client component", async () => {
    render(
      await LocaleLayout({
        children: <main>Localized content</main>,
      }),
    );

    expect(screen.getByText("Localized content")).toBeInTheDocument();
    expect(getMessagesMock).not.toHaveBeenCalled();
    expect(nextIntlClientProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({ messages: null }),
      undefined,
    );
  });
});
