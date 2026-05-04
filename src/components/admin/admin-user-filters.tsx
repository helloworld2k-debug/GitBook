type AdminUserFiltersProps = {
  actionPath: string;
  labels: {
    allRoles: string;
    allStatuses: string;
    allTypes: string;
    apply: string;
    createdFrom: string;
    createdTo: string;
    moreFilters: string;
    reset: string;
    role: string;
    search: string;
    searchPlaceholder: string;
    status: string;
    type: string;
  };
  values: {
    createdFrom?: string;
    createdTo?: string;
    query?: string;
    role?: string;
    status?: string;
    type?: string;
  };
};

export function AdminUserFilters({ actionPath, labels, values }: AdminUserFiltersProps) {
  return (
    <form action={actionPath} className="mt-6 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
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
        {labels.role}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.role ?? ""} name="role">
          <option value="">{labels.allRoles}</option>
          <option value="owner">Owner</option>
          <option value="operator">Operator</option>
          <option value="user">User</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.type}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.type ?? ""} name="type">
          <option value="">{labels.allTypes}</option>
          <option value="admin">Admin</option>
          <option value="standard">Standard</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.status}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.status ?? ""} name="status">
          <option value="">{labels.allStatuses}</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="deleted">Deleted</option>
        </select>
      </label>
      <details className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 lg:col-span-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">{labels.moreFilters}</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {labels.createdFrom}
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.createdFrom ?? ""} name="createdFrom" type="date" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            {labels.createdTo}
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.createdTo ?? ""} name="createdTo" type="date" />
          </label>
        </div>
      </details>
      <div className="flex flex-wrap gap-3 lg:col-span-4">
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
