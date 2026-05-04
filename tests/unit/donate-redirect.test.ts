import { describe, expect, it, vi } from "vitest";
import DonatePage from "@/app/[locale]/donate/page";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("legacy donate page redirect", () => {
  it("redirects the localized donate route to contributions", async () => {
    await expect(
      DonatePage({ params: Promise.resolve({ locale: "ja" }) }),
    ).rejects.toThrow("redirect:/ja/contributions");
  });

  it("falls back to English contributions for unsupported locales", async () => {
    await expect(
      DonatePage({ params: Promise.resolve({ locale: "fr" }) }),
    ).rejects.toThrow("redirect:/en/contributions");
  });
});
