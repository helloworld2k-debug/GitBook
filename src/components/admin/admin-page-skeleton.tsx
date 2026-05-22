"use client";

import { AdminTableSkeleton } from "./admin-table-skeleton";

export function AdminPageSkeleton({
  showHeader = true,
  showFilters = true,
  showTable = true,
  colCount = 6,
}: {
  showHeader?: boolean;
  showFilters?: boolean;
  showTable?: boolean;
  colCount?: number;
}) {
  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl animate-pulse">
        {showHeader && (
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 h-10 w-32 rounded-md bg-slate-200" />
              <div className="mt-2 h-10 w-64 rounded-md bg-slate-200" />
              <div className="mt-2 h-5 w-96 max-w-full rounded-md bg-slate-200" />
            </div>
          </div>
        )}
        {showFilters && (
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="h-11 w-64 max-w-full rounded-md bg-slate-200" />
            <div className="h-10 w-24 rounded-md bg-slate-200" />
            <div className="h-10 w-24 rounded-md bg-slate-200" />
          </div>
        )}
        {showTable && <AdminTableSkeleton colCount={colCount} />}
      </section>
    </div>
  );
}
