import { getCertificateTemplate, type CertificateTemplate } from "@/lib/certificates/templates";

type CertificateViewProps = {
  certificateNumber: string;
  copy: {
    brand: string;
    certificateNumber: string;
    description: string;
    issued: string;
    pendingIssueDate: string;
    presentedTo: string;
    title: string;
  };
  recipientName: string;
  label: string;
  issuedAt: string | Date | null;
  locale: string;
  template?: CertificateTemplate;
};

export function formatCertificateIssuedDate(
  issuedAt: CertificateViewProps["issuedAt"],
  locale: string,
  pendingIssueDate: string,
) {
  if (!issuedAt) {
    return pendingIssueDate;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(issuedAt));
}

export function getCertificateTypeLabel(type: "donation" | "honor", labels: { donation: string; honor: string }) {
  return type === "honor" ? labels.honor : labels.donation;
}

export function CertificateView({
  certificateNumber,
  copy,
  recipientName,
  label,
  issuedAt,
  locale,
  template = getCertificateTemplate("donation", "monthly"),
}: CertificateViewProps) {
  const issuedDate = formatCertificateIssuedDate(issuedAt, locale, copy.pendingIssueDate);
  const backgroundStyle = template.backgroundUrl ? { backgroundImage: `url(${template.backgroundUrl})` } : undefined;
  const accentGlow = template.code === "yearly" ? "bg-amber-200/20" : "bg-cyan-300/15";
  const secondaryGlow = template.code === "monthly" ? "bg-sky-500/15" : "bg-violet-500/20";
  const borderTone = template.code === "yearly" ? "border-amber-200/35" : "border-cyan-200/25";
  const badgeTone =
    template.code === "yearly"
      ? "border-amber-200/35 bg-amber-200/10 text-amber-50"
      : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";

  return (
    <section
      aria-label={label}
      data-certificate-template={template.code}
      className="relative overflow-hidden rounded-lg border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-cyan-950/30"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:44px_44px]"
      />
      <div aria-hidden="true" className={`absolute -left-24 top-10 h-64 w-64 rounded-full ${accentGlow} blur-3xl`} />
      <div aria-hidden="true" className={`absolute -right-20 bottom-0 h-72 w-72 rounded-full ${secondaryGlow} blur-3xl`} />
      <div className="relative p-4 sm:p-6 lg:p-8">
        <div className="relative min-h-[620px] overflow-hidden rounded-lg border border-cyan-200/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96)_52%,rgba(15,23,42,0.98))] px-5 py-7 text-center sm:min-h-[560px] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center opacity-80"
            data-testid="certificate-background"
            style={backgroundStyle}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.18),rgba(2,6,23,0.78)_76%),linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.5))]"
          />
          <div aria-hidden="true" className={`absolute inset-4 rounded-md border ${borderTone}`} />
          {template.code === "yearly" ? (
            <div aria-hidden="true" className="absolute inset-8 rounded-md border border-amber-100/20" />
          ) : null}
          <div aria-hidden="true" className="absolute inset-x-10 top-10 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-10 bottom-10 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

          <div className="relative mx-auto flex max-w-3xl flex-col items-center">
            <div className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-semibold uppercase ${badgeTone}`}>
              {copy.brand}
            </div>
            <p className="mt-6 text-sm font-medium text-amber-100">{label}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">{copy.title}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{copy.description}</p>

            <div className="mt-8 flex w-full items-center gap-3" aria-hidden="true">
              <div className="h-px flex-1 bg-cyan-200/20" />
              <div className="size-2 rounded-full bg-amber-200 shadow-[0_0_20px_rgba(253,230,138,0.8)]" />
              <div className="h-px flex-1 bg-cyan-200/20" />
            </div>

            <p className="mt-8 text-xs font-semibold uppercase text-cyan-100">{copy.presentedTo}</p>
            <p className="mt-3 max-w-full break-words text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              {recipientName}
            </p>
          </div>

          <div className="relative mt-10 grid gap-3 text-left text-sm sm:grid-cols-2">
            <div className="rounded-md border border-cyan-300/15 bg-white/[0.05] p-4">
              <p className="font-semibold text-cyan-100">{copy.certificateNumber}</p>
              <p className="mt-2 break-words font-mono text-sm text-slate-200">{certificateNumber}</p>
            </div>
            <div className="rounded-md border border-amber-200/20 bg-amber-200/[0.06] p-4">
              <p className="font-semibold text-amber-100">{copy.issued}</p>
              <p className="mt-2 text-slate-200">{issuedDate}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
