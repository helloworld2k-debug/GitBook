import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminPageHeader, AdminShell, AdminTableShell } from "@/components/admin/admin-shell";

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: ({ currentLocale }: { currentLocale: string }) => <div>Language {currentLocale}</div>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const adminLabels = {
  auditLogs: "Audit Logs",
  backToAdmin: "Back to admin",
  certificates: "Certificates",
  contributionPricing: "Contribution pricing",
  dashboard: "Overview",
  donations: "Donations",
  language: "Language",
  licenses: "Licenses",
  menu: "Menu",
  news: "News",
  notifications: "Notifications",
  policies: "Policy pages",
  registrationSecurity: "Registration security",
  signOut: "Sign out",
  supportFeedback: "Feedback",
  supportFeedbackUnread: (count: number) => `${count} feedback threads need follow-up`,
  supportSettings: "Support settings",
  releases: "Releases",
  returnToSite: "Return to site",
  users: "Users",
};

describe("AdminShell", () => {
  it("renders professional admin navigation and top-bar actions", () => {
    render(
      <AdminShell adminLabel="admin@example.com" currentPath="/admin/users" labels={adminLabels} locale="en">
        <p>Admin content</p>
      </AdminShell>,
    );

    const sidebar = screen.getByRole("navigation", { name: "Admin" });
    expect(sidebar).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Overview/ })).toHaveAttribute("href", "/admin");
    expect(within(sidebar).getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/admin/users");
    expect(within(sidebar).getByRole("link", { name: /News/ })).toHaveAttribute("href", "/admin/news");
    expect(within(sidebar).getByRole("link", { name: /Notifications/ })).toHaveAttribute("href", "/admin/notifications");
    expect(within(sidebar).getByRole("link", { name: /Policy pages/ })).toHaveAttribute("href", "/admin/policies");
    expect(within(sidebar).getByRole("link", { name: /Feedback/ })).toHaveAttribute("href", "/admin/support-feedback");
    expect(within(sidebar).getByRole("link", { name: /Contribution pricing/ })).toHaveAttribute("href", "/admin/contribution-pricing");
    expect(within(sidebar).getByRole("link", { name: /Support settings/ })).toHaveAttribute("href", "/admin/support-settings");
    expect(within(sidebar).getByRole("link", { name: /Registration security/ })).toHaveAttribute("href", "/admin/registration-security");
    expect(screen.getByRole("navigation", { name: "Admin mobile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return to site/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });

  it("shows a follow-up marker on feedback when there are unread threads", () => {
    render(
      <AdminShell
        adminLabel="admin@example.com"
        currentPath="/admin"
        labels={adminLabels}
        locale="en"
        unreadFeedbackCount={3}
      >
        <p>Admin content</p>
      </AdminShell>,
    );

    expect(screen.getAllByLabelText("3 feedback threads need follow-up").length).toBeGreaterThan(0);
  });
});

describe("AdminPageHeader", () => {
  it("renders breadcrumbs and a back link for nested admin pages", () => {
    render(
      <AdminPageHeader
        backHref="/admin"
        backLabel="Back to admin"
        description="Manage users and devices."
        eyebrow="Admin"
        title="Users"
      />,
    );

    expect(screen.getByRole("link", { name: "Back to admin" })).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("Manage users and devices.")).toBeInTheDocument();
  });
});

describe("AdminTableShell", () => {
  it("creates a stable responsive scroll container for dense admin tables", () => {
    render(
      <AdminTableShell
        mobileCards={
          <article>
            <h2>Mobile record</h2>
            <p>Condensed admin details</p>
          </article>
        }
      >
        <table>
          <tbody>
            <tr>
              <td>Dense content</td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>,
    );

    const shell = screen.getByTestId("admin-table-shell");

    expect(shell).toHaveClass("overflow-x-auto", "overscroll-x-contain", "rounded-b-md");
    expect(shell).toHaveAttribute("tabIndex", "0");
    expect(shell).toHaveAttribute("aria-label", "Scrollable admin table");
    expect(shell).toHaveClass("hidden", "md:block");

    const mobileShell = screen.getByTestId("admin-mobile-cards");
    expect(mobileShell).toHaveClass("grid", "md:hidden");
    expect(screen.getByRole("heading", { name: "Mobile record" })).toBeInTheDocument();
  });
});
