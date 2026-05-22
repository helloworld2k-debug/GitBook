"use client";

export function AdminTableSkeleton({
  colCount = 6,
  rowCount = 10
}: {
  colCount?: number;
  rowCount?: number;
}) {
  return (
    <div className="animate-pulse">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {Array.from({ length: colCount }).map((_, i) => (
            <div
              key={`header-${i}`}
              className="h-10 flex-1 border-r border-slate-200 last:border-r-0"
            />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex border-b border-slate-200"
          >
            {Array.from({ length: colCount }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-14 flex-1 border-r border-slate-200 bg-white last:border-r-0"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
