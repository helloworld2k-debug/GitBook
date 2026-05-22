import { Link } from "@/i18n/routing";

type AdminPaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
  labels: {
    previous: string;
    next: string;
    page: string;
    of: string;
  };
};

export function AdminPagination({ currentPage, totalPages, basePath, labels }: AdminPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages: (number | string)[] = [];
  const showPages = 5;

  if (totalPages <= showPages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
  }

  const buildPageUrl = (page: number) => {
    // Parse the basePath to extract pathname and existing search params
    const [pathname, existingQuery] = basePath.split("?");
    const url = new URL(pathname, "http://dummy");

    // Add existing query params (if any)
    if (existingQuery) {
      const params = new URLSearchParams(existingQuery);
      params.forEach((value, key) => {
        if (key !== "page") {
          url.searchParams.set(key, value);
        }
      });
    }

    url.searchParams.set("page", page.toString());
    return `${url.pathname}${url.search}`;
  };

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-slate-200 pt-4">
      <div className="text-sm text-slate-700">
        {labels.page} <span className="font-semibold">{currentPage}</span> {labels.of}{" "}
        <span className="font-semibold">{totalPages}</span>
      </div>
      <div className="flex gap-2">
        {currentPage > 1 && (
          <Link
            className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            href={buildPageUrl(currentPage - 1)}
          >
            {labels.previous}
          </Link>
        )}
        <div className="hidden sm:flex gap-1">
          {pages.map((page, index) => {
            if (page === "...") {
              return (
                <span key={`ellipsis-${index}`} className="min-h-10 inline-flex items-center px-2 text-slate-500">
                  ...
                </span>
              );
            }
            const pageNumber = page as number;
            const isActive = pageNumber === currentPage;
            return (
              <Link
                key={pageNumber}
                className={`min-h-10 inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
                }`}
                href={buildPageUrl(pageNumber)}
              >
                {pageNumber}
              </Link>
            );
          })}
        </div>
        {currentPage < totalPages && (
          <Link
            className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            href={buildPageUrl(currentPage + 1)}
          >
            {labels.next}
          </Link>
        )}
      </div>
    </nav>
  );
}
