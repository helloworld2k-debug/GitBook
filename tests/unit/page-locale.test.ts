import { describe, expect, it, vi } from "vitest";
import { resolvePageLocale } from "@/lib/i18n/page-locale";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const setRequestLocaleMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: setRequestLocaleMock,
}));

describe("resolvePageLocale", () => {
  it("returns supported locales and sets the request locale", () => {
    expect(resolvePageLocale("en")).toBe("en");
    expect(resolvePageLocale("zh-Hant")).toBe("zh-Hant");
    expect(setRequestLocaleMock).toHaveBeenCalledWith("en");
    expect(setRequestLocaleMock).toHaveBeenCalledWith("zh-Hant");
  });

  it("not-founds unsupported locales", () => {
    expect(() => resolvePageLocale("bad")).toThrow("NEXT_NOT_FOUND");
  });
});
