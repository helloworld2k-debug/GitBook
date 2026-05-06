import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  ClipboardList,
  FileText,
  Gauge,
  Gift,
  Home,
  KeyRound,
  LogOut,
  MessageSquareText,
  Menu,
  Package,
  Users,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { siteConfig, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { isAdminFeedbackKey, type AdminFeedbackKey, type AdminFeedbackTone } from "@/lib/admin/feedback";
import { signOutAction } from "@/app/[locale]/dashboard/actions";

type AdminShellLabels = {
  auditLogs: string;
  backToAdmin: string;
  certificates: string;
  dashboard: string;
  donations: string;
  language: string;
  licenses: string;
  menu: string;
  notifications: string;
  releases: string;
  returnToSite: string;
  signOut: string;
  supportFeedback: string;
  supportSettings: string;
  users: string;
};

type AdminShellProps = {
  adminLabel: string;
  children: React.ReactNode;
  currentPath: string;
  labels: AdminShellLabels;
  locale: Locale;
};

const navIconClass = "size-4 shrink-0";

function getAdminItems(labels: AdminShellLabels) {
  return [
    { href: "/admin", label: labels.dashboard, icon: Gauge },
    { href: "/admin/donations", label: labels.donations, icon: Gift },
    { href: "/admin/certificates", label: labels.certificates, icon: BadgeCheck },
    { href: "/admin/releases", label: labels.releases, icon: Package },
    { href: "/admin/notifications", label: labels.notifications, icon: Bell },
    { href: "/admin/support-feedback", label: labels.supportFeedback, icon: MessageSquareText },
    { href: "/admin/support-settings", label: labels.supportSettings, icon: MessageSquareText },
    { href: "/admin/licenses", label: labels.licenses, icon: KeyRound },
    { href: "/admin/users", label: labels.users, icon: Users },
    { href: "/admin/audit-logs", label: labels.auditLogs, icon: ClipboardList },
  ];
}

function isActive(currentPath: string, href: string) {
  return href === "/admin" ? currentPath === href : currentPath.startsWith(href);
}

function AdminNavList({ currentPath, items }: { currentPath: string; items: ReturnType<typeof getAdminItems> }) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(currentPath, item.href);
        return (
          <Link
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 ${
              active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className={navIconClass} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ adminLabel, children, currentPath, labels, locale }: AdminShellProps) {
  const items = getAdminItems(labels);

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1800px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block" aria-label="Admin sidebar">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
            <span className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">AI</span>
            <div>
              <p className="text-sm font-semibold text-slate-950">{siteConfig.name}</p>
              <p className="text-xs text-slate-500">Admin Console</p>
            </div>
          </div>
          <nav aria-label="Admin" className="space-y-1 px-3 py-4">
            <AdminNavList currentPath={currentPath} items={items} />
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
            <div className="flex min-h-16 flex-col items-stretch gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <details className="group relative lg:hidden">
                  <summary
                    aria-label={labels.menu}
                    className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 [&::-webkit-details-marker]:hidden"
                  >
                    <Menu aria-hidden="true" className="size-5" />
                  </summary>
                  <nav
                    aria-label="Admin mobile"
                    className="absolute left-0 top-12 z-50 w-[min(82vw,20rem)] space-y-1 rounded-md border border-slate-200 bg-white p-2 shadow-xl"
                  >
                    <AdminNavList currentPath={currentPath} items={items} />
                  </nav>
                </details>
                <Link
                  className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                  href="/"
                >
                  <Home aria-hidden="true" className="size-4" />
                  <span className="truncate">{labels.returnToSite}</span>
                </Link>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <LanguageSwitcher currentLocale={locale} label={labels.language} variant="admin" />
                <form action={signOutAction.bind(null, locale)}>
                  <button
                    className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                    type="submit"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {labels.signOut}
                  </button>
                </form>
                <div className="hidden min-h-10 max-w-52 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 sm:flex">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate">{adminLabel}</span>
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

type AdminPageHeaderProps = {
  backHref?: string;
  backLabel?: string;
  description?: string;
  eyebrow: string;
  title: string;
};

export function AdminPageHeader({ backHref, backLabel, description, eyebrow, title }: AdminPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {backHref && backLabel ? (
          <Link
            className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            href={backHref}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {backLabel}
          </Link>
        ) : null}
        <p className="text-sm font-medium text-slate-500">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
    </div>
  );
}

const adminFeedbackMessages: Record<AdminFeedbackKey, string> = {
  "account-profile-updated": "User profile updated.",
  "bulk-user-role-updated": "Updated user role for the selected users.",
  "bulk-user-role-update-failed": "Unable to update user role for the selected users.",
  "bulk-user-status-updated": "Updated account status for the selected users.",
  "bulk-user-status-update-failed": "Unable to update account status for the selected users.",
  "certificate-revoked": "Certificate revoked.",
  "cloud-sync-lease-revoked": "Cloud sync lease revoked.",
  "cloud-sync-lease-revoke-failed": "Unable to revoke cloud sync lease.",
  "desktop-session-revoked": "Desktop session revoked.",
  "desktop-session-revoke-failed": "Unable to revoke desktop session.",
  "donation-tier-updated": "Development support tier updated.",
  "donation-tier-update-failed": "Unable to update development support tier.",
  "feedback-replied": "Reply sent to the user.",
  "feedback-reply-failed": "Unable to send reply.",
  "feedback-updated": "Feedback status updated.",
  "feedback-update-failed": "Unable to update feedback.",
  "manual-donation-added": "Manual donation added.",
  "manual-donation-failed": "Unable to add manual donation.",
  "notification-created": "Notification created.",
  "notification-published": "Notification published.",
  "notification-unpublished": "Notification unpublished.",
  "operation-failed": "Unable to complete this operation.",
  "profile-update-failed": "Unable to update user profile.",
  "release-created": "Release created.",
  "release-updated": "Release updated.",
  "role-updated": "User role updated.",
  "role-update-failed": "Unable to update user role.",
  "status-updated": "Account status updated.",
  "status-update-failed": "Unable to update account status.",
  "support-contact-updated": "Support contact updated.",
  "support-contact-update-failed": "Unable to update support contact.",
  "trial-code-created": "Trial code created.",
  "trial-code-create-failed": "Unable to create trial code.",
  "trial-code-deleted": "Trial code deleted.",
  "trial-code-delete-failed": "Unable to delete trial code.",
  "trial-code-status-updated": "Trial code status updated.",
  "trial-code-status-update-failed": "Unable to update trial code status.",
  "trial-code-updated": "Trial code updated.",
  "trial-code-update-failed": "Unable to update trial code.",
  "trial-machine-unbound": "Trial machine unbound.",
  "trial-machine-unbind-failed": "Unable to unbind trial machine.",
  "user-permanently-deleted": "User permanently deleted.",
  "user-permanent-delete-failed": "Unable to permanently delete the user.",
  "user-soft-deleted": "User soft-deleted.",
  "user-soft-delete-failed": "Unable to soft-delete the user.",
};

export function AdminFeedbackBanner({
  error,
  notice,
}: {
  error?: string | string[] | null;
  notice?: string | string[] | null;
}) {
  const rawError = Array.isArray(error) ? error[0] : error;
  const rawNotice = Array.isArray(notice) ? notice[0] : notice;
  const tone: AdminFeedbackTone | null = isAdminFeedbackKey(rawError) ? "error" : isAdminFeedbackKey(rawNotice) ? "notice" : null;
  const key = tone === "error" ? rawError : rawNotice;

  if (!tone || !isAdminFeedbackKey(key)) {
    return null;
  }

  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-medium ${toneClass}`} role={tone === "error" ? "alert" : "status"}>
      {adminFeedbackMessages[key]}
    </div>
  );
}

export function AdminCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-md border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

export function AdminTableShell({
  children,
  empty,
  label = "Scrollable admin table",
  mobileCards,
}: {
  children: React.ReactNode;
  empty?: React.ReactNode;
  label?: string;
  mobileCards?: React.ReactNode;
}) {
  return (
    <>
      {mobileCards ? (
        <div className="grid gap-3 p-3 md:hidden" data-testid="admin-mobile-cards">
          {empty ?? null}
          {mobileCards}
        </div>
      ) : null}
      <div
        aria-label={label}
        className={`${mobileCards ? "hidden md:block" : ""} overflow-x-auto overscroll-x-contain rounded-b-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950`}
        data-testid="admin-table-shell"
        role="region"
        tabIndex={0}
      >
        {empty ?? null}
        {children}
      </div>
    </>
  );
}

export function AdminStatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "danger" | "neutral" | "success" | "warning" }) {
  const toneClass = {
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  }[tone];

  return <span className={`inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-semibold ${toneClass}`}>{children}</span>;
}
