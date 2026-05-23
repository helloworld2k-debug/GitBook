import { Link } from "@/i18n/routing";
import { buildAdminLicenseUrl, type AdminLicenseParsedSearch, type AdminLicenseTab } from "@/lib/admin/license-management";

type TabLabels = Record<AdminLicenseTab, string>;

const tabs: AdminLicenseTab[] = ["codes", "batches", "redemptions", "access", "diagnostics"];

export function AdminLicenseTabs({
  basePath,
  labels,
  parsed,
}: {
  basePath: string;
  labels: TabLabels;
  parsed: AdminLicenseParsedSearch;
}) {
  return (
    <nav aria-label="License management sections" className="mb-6 overflow-x-auto border-b border-slate-200">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const active = parsed.tab === tab;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-950"
              }`}
              href={buildAdminLicenseUrl(basePath, parsed, { page: 1, tab })}
              key={tab}
            >
              {labels[tab]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
