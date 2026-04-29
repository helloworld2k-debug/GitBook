import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { Link } from "@/i18n/routing";
import { requireAdmin } from "@/lib/auth/guards";

type AdminPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

const adminLinks = [
  {
    href: "/admin/donations",
    title: "Donations",
    description: "Review payment provider records, statuses, and transaction IDs.",
  },
  {
    href: "/admin/certificates",
    title: "Certificates",
    description: "Review issued certificate numbers, types, statuses, and issue dates.",
  },
];

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">Admin tools</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Admin</h1>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                <span className="block text-base font-semibold text-slate-950">{link.title}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">{link.description}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
