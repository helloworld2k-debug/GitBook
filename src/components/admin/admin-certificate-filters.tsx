type AdminCertificateFiltersProps = {
  actionPath: string;
  labels: {
    allStatuses: string;
    allTypes: string;
    apply: string;
    issuedFrom: string;
    issuedTo: string;
    moreFilters: string;
    reset: string;
    search: string;
    searchPlaceholder: string;
    status: string;
    type: string;
  };
  values: {
    issuedFrom?: string;
    issuedTo?: string;
    query?: string;
    status?: string;
    type?: string;
  };
};

export function AdminCertificateFilters({ actionPath, labels, values }: AdminCertificateFiltersProps) {
  return (
    <form action={actionPath} className="mt-6 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.search}
        <input
          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
          defaultValue={values.query ?? ""}
          name="query"
          placeholder={labels.searchPlaceholder}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.type}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.type ?? ""} name="type">
          <option value="">{labels.allTypes}</option>
          <option value="donation">Donation</option>
          <option value="honor">Honor</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.status}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.status ?? ""} name="status">
          <option value="">{labels.allStatuses}</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="generation_failed">Failed</option>
        </select>
      </label>
      <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 lg:col-span-2">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">{labels.moreFilters}</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {labels.issuedFrom}
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.issuedFrom ?? ""} name="issuedFrom" type="date" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {labels.issuedTo}
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.issuedTo ?? ""} name="issuedTo" type="date" />
          </label>
        </div>
      </details>
      <div className="flex flex-wrap gap-3 lg:col-span-3">
        <button className="inline-flex min-h-11 items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">
          {labels.apply}
        </button>
        <a className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" href={actionPath}>
          {labels.reset}
        </a>
      </div>
    </form>
  );
}
