type CertificateViewProps = {
  certificateNumber: string;
  recipientName: string;
  label: string;
  issuedAt: string | Date | null;
};

function formatIssuedDate(issuedAt: CertificateViewProps["issuedAt"]) {
  if (!issuedAt) {
    return "Pending issue date";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(issuedAt));
}

export function CertificateView({ certificateNumber, recipientName, label, issuedAt }: CertificateViewProps) {
  return (
    <section className="border border-slate-300 bg-white p-6 shadow-sm sm:p-10" aria-label={label}>
      <div className="border border-slate-200 p-6 text-center sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Three Friends</p>
        <h1 className="mt-6 text-3xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
          Certificate of Support
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">
          This certificate is presented with gratitude for meaningful support of independent software development.
        </p>
        <div className="mx-auto mt-8 h-px max-w-md bg-slate-200" />
        <p className="mt-8 text-sm uppercase tracking-[0.18em] text-slate-500">Presented to</p>
        <p className="mt-3 break-words text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
          {recipientName}
        </p>
        <p className="mt-5 text-lg font-medium text-slate-700">{label}</p>
        <div className="mt-10 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div className="border border-slate-200 p-4">
            <p className="font-semibold text-slate-950">Certificate No.</p>
            <p className="mt-1 break-words">{certificateNumber}</p>
          </div>
          <div className="border border-slate-200 p-4">
            <p className="font-semibold text-slate-950">Issued</p>
            <p className="mt-1">{formatIssuedDate(issuedAt)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
