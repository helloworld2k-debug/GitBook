import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { supportedLocales, type Locale } from "@/config/site";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminCertificatesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

function formatIssuedAt(value: string | null, locale: string) {
  if (!value) {
    return "Not issued";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function AdminCertificatesPage({ params }: AdminCertificatesPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireAdmin(locale);

  const supabase = await createSupabaseServerClient();
  const { data: certificates, error } = await supabase
    .from("certificates")
    .select("id,certificate_number,type,status,issued_at")
    .order("issued_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Admin certificates</h1>
          </div>
          <section className="mt-6 rounded-md border border-slate-200 bg-white shadow-sm">
            {certificates && certificates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Certificate number</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {certificates.map((certificate) => (
                      <tr key={certificate.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-950">
                          {certificate.certificate_number}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{certificate.type}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{certificate.status}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatIssuedAt(certificate.issued_at, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-600">No certificates found.</p>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
