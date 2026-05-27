import { render, screen, within } from "@testing-library/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { AdminDataWorkbench, AdminPageHeader, AdminShell, AdminStandardPage, AdminStatusBadge, AdminTableShell } from "@/components/admin/admin-shell";

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
  archivedUsers: "Archived users",
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
    const { container } = render(
      <AdminShell adminLabel="admin@example.com" currentPath="/admin/users" labels={adminLabels} locale="en">
        <p>Admin content</p>
      </AdminShell>,
    );

    const sidebar = screen.getByRole("navigation", { name: "Admin" });
    expect(sidebar).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: /Overview/ })).toHaveAttribute("href", "/admin");
    expect(within(sidebar).getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/admin/users");
    expect(within(sidebar).queryByRole("link", { name: /Archived users/ })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: /Certificates/ })).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/certificates"]')).not.toBeInTheDocument();
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

  it("groups admin navigation by operator task area", () => {
    render(
      <AdminShell adminLabel="admin@example.com" currentPath="/admin/licenses" labels={adminLabels} locale="en">
        <p>Admin content</p>
      </AdminShell>,
    );

    const sidebar = screen.getByRole("navigation", { name: "Admin" });
    for (const group of ["Overview", "Operations", "Content", "Trust & Support"]) {
      expect(within(sidebar).getByLabelText(group)).toBeInTheDocument();
    }

    const operations = within(sidebar).getByLabelText("Operations");
    expect(within(operations).getByRole("link", { name: /Donations/ })).toHaveAttribute("href", "/admin/donations");
    expect(within(operations).getByRole("link", { name: /Releases/ })).toHaveAttribute("href", "/admin/releases");
    expect(within(operations).getByRole("link", { name: /Licenses/ })).toHaveAttribute("href", "/admin/licenses");
    expect(within(operations).getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/admin/users");

    const trust = within(sidebar).getByLabelText("Trust & Support");
    expect(within(trust).getByRole("link", { name: /Feedback/ })).toHaveAttribute("href", "/admin/support-feedback");
    expect(within(trust).getByRole("link", { name: /Support settings/ })).toHaveAttribute("href", "/admin/support-settings");
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

  it("keeps admin chrome fixed while the content pane owns page scrolling", () => {
    render(
      <AdminShell adminLabel="admin@example.com" currentPath="/admin/users" labels={adminLabels} locale="en">
        <p>Admin content</p>
      </AdminShell>,
    );

    const shell = screen.getByTestId("admin-shell");
    const sidebar = screen.getByLabelText("Admin sidebar");
    const header = screen.getByRole("banner", { name: "Admin top bar" });
    const content = screen.getByRole("main", { name: "Admin content" });
    const mobileNav = screen.getByRole("navigation", { name: "Admin mobile" });

    expect(shell).toHaveClass("h-dvh", "overflow-hidden");
    expect(sidebar).toHaveClass("sticky", "top-0", "h-dvh", "overflow-y-auto");
    expect(header).toHaveClass("sticky", "top-0", "shrink-0");
    expect(content).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain");
    expect(mobileNav).toHaveClass("max-h-[calc(100dvh-5rem)]", "overflow-y-auto");
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

  it("can keep dense table cards visible until the large-screen breakpoint", () => {
    render(
      <AdminTableShell
        cardsUntil="lg"
        mobileCards={
          <article>
            <h2>Tablet card</h2>
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

    expect(screen.getByTestId("admin-mobile-cards")).toHaveClass("lg:hidden");
    expect(screen.getByTestId("admin-table-shell")).toHaveClass("hidden", "lg:block");
  });
});

describe("admin page width primitives", () => {
  it("separates standard pages from data workbench pages", () => {
    render(
      <>
        <AdminStandardPage>
          <p>Readable settings</p>
        </AdminStandardPage>
        <AdminDataWorkbench>
          <p>Wide table</p>
        </AdminDataWorkbench>
      </>,
    );

    expect(screen.getByText("Readable settings").parentElement).toHaveClass("mx-auto", "max-w-7xl");
    expect(screen.getByText("Wide table").parentElement).toHaveClass("mx-auto", "max-w-[1600px]");
  });
});

describe("AdminStatusBadge", () => {
  it("can render non-color semantic icons", () => {
    render(
      <>
        <AdminStatusBadge icon={CheckCircle2} tone="success">
          Active
        </AdminStatusBadge>
        <AdminStatusBadge icon={AlertTriangle} tone="danger">
          Blocked
        </AdminStatusBadge>
      </>,
    );

    const activeBadge = screen.getByText("Active").closest("span");
    const blockedBadge = screen.getByText("Blocked").closest("span");

    expect(activeBadge).toHaveClass("bg-emerald-50");
    expect(blockedBadge).toHaveClass("bg-red-50");
    expect(activeBadge?.querySelector("svg")).toBeInTheDocument();
    expect(blockedBadge?.querySelector("svg")).toBeInTheDocument();
  });
});
