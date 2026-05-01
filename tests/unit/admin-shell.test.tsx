import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminPageHeader, AdminShell } from "@/components/admin/admin-shell";

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
  dashboard: "Overview",
  donations: "Donations",
  language: "Language",
  licenses: "Licenses",
  menu: "Menu",
  notifications: "Notifications",
  supportFeedback: "Feedback",
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
    expect(within(sidebar).getByRole("link", { name: /Notifications/ })).toHaveAttribute("href", "/admin/notifications");
    expect(within(sidebar).getByRole("link", { name: /Feedback/ })).toHaveAttribute("href", "/admin/support-feedback");
    expect(screen.getByRole("navigation", { name: "Admin mobile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return to site/ })).toHaveAttribute("href", "/");
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Admin content")).toBeInTheDocument();
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
