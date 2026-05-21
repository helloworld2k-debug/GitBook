type AdminAuditLogFiltersProps = {
  actionPath: string;
  labels: {
    action: string;
    allActions: string;
    apply: string;
    dateFrom: string;
    dateTo: string;
    moreFilters: string;
    reset: string;
    search: string;
    searchPlaceholder: string;
    target: string;
    allTargets: string;
  };
  values: {
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
    targetType?: string;
  };
};

export function AdminAuditLogFilters({ actionPath, labels, values }: AdminAuditLogFiltersProps) {
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
        {labels.action}
        <input
          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
          defaultValue={values.action ?? ""}
          name="action"
          placeholder={labels.allActions}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.target}
        <input
          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
          defaultValue={values.targetType ?? ""}
          name="targetType"
          placeholder={labels.allTargets}
        />
      </label>
      <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 lg:col-span-2">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">{labels.moreFilters}</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {labels.dateFrom}
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.dateFrom ?? ""} name="dateFrom" type="date" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {labels.dateTo}
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.dateTo ?? ""} name="dateTo" type="date" />
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
