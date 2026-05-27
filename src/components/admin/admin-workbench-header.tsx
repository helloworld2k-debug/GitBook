type AdminWorkbenchHeaderProps = {
  description?: string;
  filters?: React.ReactNode;
  primaryAction?: React.ReactNode;
  resultSummary?: string;
  secondaryActions?: React.ReactNode;
  selectionToolbar?: React.ReactNode;
  title: string;
};

export function AdminWorkbenchHeader({
  description,
  filters,
  primaryAction,
  resultSummary,
  secondaryActions,
  selectionToolbar,
  title,
}: AdminWorkbenchHeaderProps) {
  const hasActions = Boolean(primaryAction || secondaryActions);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
          {resultSummary ? <p className="mt-2 text-sm font-medium text-slate-500">{resultSummary}</p> : null}
        </div>
        {hasActions ? (
          <div aria-label="Workbench actions" className="flex flex-wrap items-center gap-2 lg:justify-end" role="group">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
      {filters ? <div data-testid="admin-workbench-filters">{filters}</div> : null}
      {selectionToolbar ? <div data-testid="admin-workbench-selection-toolbar">{selectionToolbar}</div> : null}
    </section>
  );
}
