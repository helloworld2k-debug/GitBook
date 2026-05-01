import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

const getLocaleMock = vi.hoisted(() => vi.fn());
const getTranslationsMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getLocale: getLocaleMock,
  getTranslations: getTranslationsMock,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({ currentLocale }: { currentLocale: string }) => <div>Language {currentLocale}</div>,
}));

const navMessages: Record<string, string> = {
  accountMenu: "Account menu",
  dashboard: "Dashboard",
  donate: "Donate",
  download: "Download",
  language: "Language",
  signIn: "Sign in",
  signOut: "Sign out",
  userMenu: "Open dashboard",
};

describe("SiteHeader", () => {
  beforeEach(() => {
    getLocaleMock.mockReset().mockResolvedValue("en");
    getTranslationsMock.mockReset().mockResolvedValue((key: string) => navMessages[key] ?? key);
    createSupabaseServerClientMock.mockReset();
  });

  it("shows sign in and no dashboard link for signed-out visitors", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });

    render(await SiteHeader());

    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Donate" })).toHaveAttribute("href", "/donate");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("shows a signed-in account menu with dashboard and sign-out actions", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email: "user@example.com" } } })) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { display_name: "Ada Lovelace", email: "ada@example.com" },
              error: null,
            })),
          })),
        })),
      })),
    });

    render(await SiteHeader());

    expect(screen.getByLabelText("Open dashboard")).toBeInTheDocument();
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
  });
});
