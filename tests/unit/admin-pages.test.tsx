import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AdminPage from "@/app/[locale]/admin/page";
import AdminCertificatesPage from "@/app/[locale]/admin/certificates/page";
import AdminDonationsPage from "@/app/[locale]/admin/donations/page";

const requireAdminMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header>Site header</header>,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

function createOrderedQuery(data: unknown, error: Error | null = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ order }));

  return { order, select };
}

describe("admin pages", () => {
  beforeEach(() => {
    requireAdminMock.mockReset().mockResolvedValue({ id: "admin-1" });
    createSupabaseServerClientMock.mockReset();
  });

  it("renders the guarded admin overview without links to routes that do not exist yet", async () => {
    const element = await AdminPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en");
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /donations/i })).toHaveAttribute("href", "/admin/donations");
    expect(screen.getByRole("link", { name: /certificates/i })).toHaveAttribute("href", "/admin/certificates");
    expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("queries and renders donations for admins", async () => {
    const donationsQuery = createOrderedQuery([
      {
        id: "donation-1",
        provider: "stripe",
        status: "paid",
        amount: 5000,
        currency: "usd",
        provider_transaction_id: "txn_123",
      },
    ]);
    const from = vi.fn(() => donationsQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminDonationsPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en");
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("donations");
    expect(donationsQuery.select).toHaveBeenCalledWith("id,provider,status,amount,currency,provider_transaction_id");
    expect(donationsQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "Admin donations" })).toBeInTheDocument();
    expect(screen.getByText("stripe")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("txn_123")).toBeInTheDocument();
  });

  it("throws Supabase donation query errors", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => createOrderedQuery(null, new Error("donations failed"))),
    });

    await expect(AdminDonationsPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "donations failed",
    );
  });

  it("queries and renders certificates for admins", async () => {
    const certificatesQuery = createOrderedQuery([
      {
        id: "certificate-1",
        certificate_number: "DON-2026-000001",
        type: "donation",
        status: "active",
        issued_at: "2026-04-29T12:00:00.000Z",
      },
    ]);
    const from = vi.fn(() => certificatesQuery);
    createSupabaseServerClientMock.mockResolvedValue({ from });

    const element = await AdminCertificatesPage({ params: Promise.resolve({ locale: "en" }) });

    render(element);

    expect(requireAdminMock).toHaveBeenCalledWith("en");
    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock.mock.invocationCallOrder[0]).toBeLessThan(
      createSupabaseServerClientMock.mock.invocationCallOrder[0],
    );
    expect(from).toHaveBeenCalledWith("certificates");
    expect(certificatesQuery.select).toHaveBeenCalledWith("id,certificate_number,type,status,issued_at");
    expect(certificatesQuery.order).toHaveBeenCalledWith("issued_at", { ascending: false });
    expect(screen.getByRole("heading", { name: "Admin certificates" })).toBeInTheDocument();
    expect(screen.getByText("DON-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("donation")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("Apr 29, 2026")).toBeInTheDocument();
  });

  it("throws Supabase certificate query errors", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => createOrderedQuery(null, new Error("certificates failed"))),
    });

    await expect(AdminCertificatesPage({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "certificates failed",
    );
  });
});
