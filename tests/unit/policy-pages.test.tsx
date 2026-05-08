import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PolicyPage from "@/app/[locale]/policies/[slug]/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

describe("PolicyPage", () => {
  it("renders an editable English policy page from the database", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      from: (table: string) => {
        if (table !== "policy_pages") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  body: "Use GitBook AI licenses responsibly.\\n\\nCloud sync access follows the active entitlement on your account.",
                  slug: "terms",
                  summary: "Rules for using GitBook AI downloads, accounts, licenses, and support.",
                  title: "Terms of Service",
                  updated_at: "2026-05-08T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
        };
      },
    });

    render(await PolicyPage({ params: Promise.resolve({ locale: "en", slug: "terms" }) }));

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText("Rules for using GitBook AI downloads, accounts, licenses, and support.")).toBeInTheDocument();
    expect(screen.getByText("Use GitBook AI licenses responsibly.")).toBeInTheDocument();
    expect(screen.getByText("Cloud sync access follows the active entitlement on your account.")).toBeInTheDocument();
  });
});
