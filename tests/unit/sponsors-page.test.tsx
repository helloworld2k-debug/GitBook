import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SponsorsPage from "@/app/[locale]/sponsors/page";

const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: "sponsors") => {
    const messages = {
      eyebrow: "Sponsor wall",
      title: "Supporters",
      subtitle: "A public thank-you.",
      wallTitle: "Public supporters",
      fallbackDisplayName: "Supporter",
      paidSummary: "{count} paid donations · {total}",
      empty: "No public supporters yet.",
      unavailable: "The sponsor wall is temporarily unavailable.",
      levels: {
        bronze: "Bronze",
        silver: "Silver",
      },
    };

    return (key: string, values?: Record<string, string | number>) => {
      const value = key.split(".").reduce<unknown>((current, segment) => {
        if (current && typeof current === "object" && segment in current) {
          return (current as Record<string, unknown>)[segment];
        }

        return undefined;
      }, messages);

      if (typeof value !== "string") {
        throw new Error(`Missing test message: ${namespace}.${key}`);
      }

      return value.replace("{count}", String(values?.count ?? "")).replace("{total}", String(values?.total ?? ""));
    };
  }),
  setRequestLocale: vi.fn(),
}));

describe("SponsorsPage", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createSupabaseServerClientMock.mockResolvedValue({ rpc: rpcMock });
  });

  it("renders public sponsors from the aggregate without email fields", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          public_sponsor_id: "sponsor_hash",
          display_name: "Ada",
          paid_donation_count: 2,
          paid_total_amount: 5500,
          currency: "usd",
          sponsor_level_code: "silver",
        },
      ],
      error: null,
    });

    render(await SponsorsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("heading", { name: "Supporters" })).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("2 paid donations · $55")).toBeInTheDocument();
    expect(screen.getByText("Silver")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith("get_public_sponsors");
  });

  it("renders the localized fallback display name", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          public_sponsor_id: "sponsor_hash",
          display_name: null,
          paid_donation_count: 1,
          paid_total_amount: 500,
          currency: "usd",
          sponsor_level_code: "bronze",
        },
      ],
      error: null,
    });

    render(await SponsorsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByText("Supporter")).toBeInTheDocument();
  });

  it("keeps the public page available when the sponsor aggregate cannot load", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("Supabase unavailable"),
    });

    render(await SponsorsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(screen.getByRole("heading", { name: "Supporters" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The sponsor wall is temporarily unavailable.");
  });
});
