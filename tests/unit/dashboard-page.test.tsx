import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/[locale]/dashboard/page";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireUser: vi.fn(),
  setupUserPage: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/auth/page-guards", () => ({
  setupUserPage: mocks.setupUserPage,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: "certificate" | "dashboard") => {
    const messages = {
      certificate: {
        pendingIssueDate: "Pending",
        types: {
          donation: "Donation Certificate",
          honor: "Honor Certificate",
        },
      },
      dashboard: {
        accessNotActive: "No active cloud sync access yet",
        accessValidUntil: "Valid until",
        accountTitle: "Account profile",
        amount: "Amount",
        certificateNumber: "Certificate number",
        certificates: "Active certificates",
        cloudSync: "Cloud sync",
        cloudSyncActive: "Active",
        cloudSyncInactive: "Inactive",
        cloudSyncStatus: "Cloud sync access",
        confirmPassword: "Confirm password",
        date: "Date",
        displayName: "Display name",
        displayNamePlaceholder: "Your name",
        donationStatuses: {
          cancelled: "Cancelled",
          failed: "Failed",
          paid: "Paid",
          pending: "Pending",
          refunded: "Refunded",
        },
        donations: "Paid donations",
        email: "Email",
        eyebrow: "AI account workspace",
        memberFallback: "GitBook AI member",
        newPassword: "New password",
        noDonations: "No donation records yet.",
        notAvailable: "Not available",
        passwordError: "Could not update password.",
        passwordMismatch: "Passwords do not match.",
        passwordSaved: "Password updated.",
        passwordTitle: "Change password",
        profileError: "Could not save profile.",
        profileSaved: "Profile saved.",
        recentCertificates: "Certificates",
        recentDonations: "Donation history",
        savePassword: "Update password",
        saveProfile: "Save profile",
        status: "Status",
        subtitle: "Manage cloud sync access, license codes, donation history, certificates, and account security in one place.",
        title: "Personal center",
        trial: {
          bindingHelp: "License code access starts immediately after redemption.",
          code: "Code",
          description: "Redeem a team-provided license code for trial, monthly, quarterly, or yearly cloud sync access.",
          duplicate: "Duplicate trial.",
          error: "Could not redeem the license code.",
          inactive: "Inactive license code.",
          invalid: "Invalid license code.",
          limit: "License code limit reached.",
          saved: "License code redeemed.",
          submit: "Redeem code",
          title: "License code",
        },
        trialRedeemedAt: "Last code redeemed at",
        type: "Type",
        viewCertificate: "View certificate",
      },
    }[namespace];

    return (key: string) => {
      const value = key.split(".").reduce<unknown>((current, segment) => {
        if (current && typeof current === "object" && segment in current) {
          return (current as Record<string, unknown>)[segment];
        }

        return undefined;
      }, messages);

      if (typeof value !== "string") {
        throw new Error(`Missing test message: ${namespace}.${key}`);
      }

      return value;
    };
  }),
  setRequestLocale: vi.fn(),
}));

function createThenableQuery<T>(result: T) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => result),
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return query;
}

describe("dashboard page", () => {
  beforeEach(() => {
    mocks.createSupabaseServerClient.mockReset();
    mocks.requireUser.mockReset();
    mocks.requireUser.mockReset().mockResolvedValue({
      email: "ada@example.com",
      id: "user-1",
      user_metadata: { name: "Ada Lovelace" },
    });
    mocks.setupUserPage.mockReset().mockResolvedValue({
      locale: "en",
      user: {
        email: "ada@example.com",
        id: "user-1",
        user_metadata: { name: "Ada Lovelace" },
      },
    });
  });

  it("moves donation certificates into the matching donation history row", async () => {

    const donationCountQuery = createThenableQuery({ count: 1, error: null });
    const certificateCountQuery = createThenableQuery({ count: 1, error: null });
    const donationsQuery = createThenableQuery({
      data: [
        {
          amount: 500,
          created_at: "2026-04-30T10:00:00.000Z",
          currency: "usd",
          id: "donation-1",
          paid_at: "2026-04-30T10:00:30.000Z",
          status: "paid",
        },
      ],
      error: null,
    });
    const donationCertificatesQuery = createThenableQuery({
      data: [
        {
          certificate_number: "GBAI-2026-D-000001",
          donation_id: "donation-1",
          id: "certificate-1",
          issued_at: "2026-04-30T10:00:31.000Z",
          type: "donation",
        },
      ],
      error: null,
    });
    const profileQuery = createThenableQuery({
      data: {
        display_name: "Ada Lovelace",
        email: "ada@example.com",
      },
      error: null,
    });
    const entitlementQuery = createThenableQuery({ data: null, error: null });
    const trialQuery = createThenableQuery({ data: null, error: null });
    const tableQueues = {
      certificates: [certificateCountQuery, donationCertificatesQuery],
      donations: [donationCountQuery, donationsQuery],
      license_entitlements: [entitlementQuery],
      profiles: [profileQuery],
      trial_code_redemptions: [trialQuery],
    };
    const from = vi.fn((table: keyof typeof tableQueues) => tableQueues[table].shift());

    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    render(
      await DashboardPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByRole("heading", { name: "Certificates" })).not.toBeInTheDocument();
    const donationHistory = screen.getByRole("heading", { name: "Donation history" }).closest("section");

    expect(donationHistory).not.toBeNull();
    expect(within(donationHistory as HTMLElement).getByRole("link", { name: "View certificate" })).toHaveAttribute(
      "href",
      "/dashboard/certificates/certificate-1",
    );
    expect(within(donationHistory as HTMLElement).getByText("GBAI-2026-D-000001")).toBeInTheDocument();
    expect(mocks.setupUserPage).toHaveBeenCalledWith("en", "/en/dashboard");
  });

  it("renders the personal center redemption box as a general license code flow", async () => {
    const emptyQuery = createThenableQuery({ data: [], error: null });
    const countQuery = createThenableQuery({ count: 0, error: null });
    const profileQuery = createThenableQuery({
      data: {
        display_name: "Ada Lovelace",
        email: "ada@example.com",
      },
      error: null,
    });
    const entitlementQuery = createThenableQuery({
      data: {
        status: "active",
        valid_until: "2026-06-01T00:00:00.000Z",
      },
      error: null,
    });
    const trialQuery = createThenableQuery({
      data: {
        bound_at: null,
        redeemed_at: "2026-05-01T00:00:00.000Z",
        trial_valid_until: "2026-06-01T00:00:00.000Z",
      },
      error: null,
    });
    const tableQueues = {
      certificates: [countQuery],
      donations: [countQuery, emptyQuery],
      license_entitlements: [entitlementQuery],
      profiles: [profileQuery],
      trial_code_redemptions: [trialQuery],
    };
    const from = vi.fn((table: keyof typeof tableQueues) => tableQueues[table].shift());

    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    render(
      await DashboardPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ trial: "saved" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "License code" })).toBeInTheDocument();
    expect(screen.getByText("Redeem a team-provided license code for trial, monthly, quarterly, or yearly cloud sync access.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("License code redeemed.");
    expect(screen.getByRole("button", { name: "Redeem code" })).toBeInTheDocument();
    expect(screen.getByText(/Last code redeemed at/)).toBeInTheDocument();
  });

  it("shows a contribution success banner after Dodo returns", async () => {
    mocks.requireUser.mockResolvedValue({
      email: "ada@example.com",
      id: "user-1",
      user_metadata: { name: "Ada Lovelace" },
    });

    const emptyQuery = createThenableQuery({ data: [], error: null });
    const countQuery = createThenableQuery({ count: 0, error: null });
    const profileQuery = createThenableQuery({
      data: {
        display_name: "Ada Lovelace",
        email: "ada@example.com",
      },
      error: null,
    });
    const entitlementQuery = createThenableQuery({ data: null, error: null });
    const trialQuery = createThenableQuery({ data: null, error: null });
    const tableQueues = {
      certificates: [countQuery],
      donations: [countQuery, emptyQuery],
      license_entitlements: [entitlementQuery],
      profiles: [profileQuery],
      trial_code_redemptions: [trialQuery],
    };
    const from = vi.fn((table: keyof typeof tableQueues) => tableQueues[table].shift());

    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    render(
      await DashboardPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ payment: "dodo-success" }),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your contribution was received. We are preparing your certificate and access updates.",
    );
  });

  it("shows a welcome banner after email verification succeeds", async () => {
    mocks.requireUser.mockResolvedValue({
      email: "ada@example.com",
      id: "user-1",
      user_metadata: { name: "Ada Lovelace" },
    });

    const emptyQuery = createThenableQuery({ data: [], error: null });
    const countQuery = createThenableQuery({ count: 0, error: null });
    const profileQuery = createThenableQuery({
      data: {
        display_name: "Ada Lovelace",
        email: "ada@example.com",
      },
      error: null,
    });
    const entitlementQuery = createThenableQuery({ data: null, error: null });
    const trialQuery = createThenableQuery({ data: null, error: null });
    const tableQueues = {
      certificates: [countQuery],
      donations: [countQuery, emptyQuery],
      license_entitlements: [entitlementQuery],
      profiles: [profileQuery],
      trial_code_redemptions: [trialQuery],
    };
    const from = vi.fn((table: keyof typeof tableQueues) => tableQueues[table].shift());

    mocks.createSupabaseServerClient.mockResolvedValue({ from });

    render(
      await DashboardPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ welcome: "verified" }),
      } as {
        params: Promise<{ locale: string }>;
        searchParams: Promise<{ welcome: string }>;
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your email has been verified and your account is ready.",
    );
  });
});
