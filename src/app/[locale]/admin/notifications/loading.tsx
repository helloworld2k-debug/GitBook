import { AdminPageSkeleton } from "@/components/admin/admin-shell";

export default function Loading() {
  return <AdminPageSkeleton colCount={5} showFilters={false} />;
}