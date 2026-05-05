import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("root page", () => {
  it("redirects to the default localized homepage instead of serving starter content", () => {
    expect(() => Home()).toThrow("redirect:/en");
  });
});
