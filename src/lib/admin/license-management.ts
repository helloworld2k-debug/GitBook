export const ADMIN_LICENSE_TABS = [
  "codes",
  "batches",
  "redemptions",
  "access",
  "diagnostics",
] as const;

export type AdminLicenseTab = (typeof ADMIN_LICENSE_TABS)[number];

export const ADMIN_LICENSE_SORTS = [
  "created_at",
  "label",
  "duration_kind",
  "channel_type",
  "is_active",
  "redemption_count",
] as const;

export type AdminLicenseSort = (typeof ADMIN_LICENSE_SORTS)[number];
export type AdminLicenseOrder = "asc" | "desc";

export type AdminLicenseFilters = {
  channel?: string;
  createdFrom?: string;
  createdTo?: string;
  deleted?: string;
  duration?: string;
  query?: string;
  redeemed?: string;
  status?: string;
};

export type AdminLicenseParsedSearch = {
  filters: AdminLicenseFilters;
  order: AdminLicenseOrder;
  page: number;
  pageSize: number;
  sort: AdminLicenseSort;
  tab: AdminLicenseTab;
};

type SearchParamsInput = Record<string, string | string[] | undefined> | undefined;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safePositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function safePageSize(value: string | undefined) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return [25, 50, 100].includes(parsed) ? parsed : 50;
}

function keep(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

export function parseAdminLicenseSearchParams(searchParams: SearchParamsInput): AdminLicenseParsedSearch {
  const tab = firstParam(searchParams?.tab);
  const sort = firstParam(searchParams?.sort);
  const order = firstParam(searchParams?.order);

  return {
    tab: ADMIN_LICENSE_TABS.includes(tab as AdminLicenseTab) ? (tab as AdminLicenseTab) : "codes",
    filters: {
      channel: keep(firstParam(searchParams?.channel)),
      createdFrom: keep(firstParam(searchParams?.createdFrom)),
      createdTo: keep(firstParam(searchParams?.createdTo)),
      deleted: keep(firstParam(searchParams?.deleted)),
      duration: keep(firstParam(searchParams?.duration)),
      query: keep(firstParam(searchParams?.query)),
      redeemed: keep(firstParam(searchParams?.redeemed)),
      status: keep(firstParam(searchParams?.status)),
    },
    sort: ADMIN_LICENSE_SORTS.includes(sort as AdminLicenseSort) ? (sort as AdminLicenseSort) : "created_at",
    order: order === "asc" ? "asc" : "desc",
    page: safePositiveInt(firstParam(searchParams?.page), 1, 10000),
    pageSize: safePageSize(firstParam(searchParams?.pageSize)),
  };
}

export function buildAdminLicenseUrl(basePath: string, parsed: AdminLicenseParsedSearch, overrides: Partial<AdminLicenseParsedSearch & AdminLicenseFilters> = {}) {
  const params = new URLSearchParams();
  const tab = overrides.tab ?? parsed.tab;
  const sort = overrides.sort ?? parsed.sort;
  const order = overrides.order ?? parsed.order;
  const page = overrides.page ?? parsed.page;
  const pageSize = overrides.pageSize ?? parsed.pageSize;
  const filters = { ...parsed.filters, ...overrides };

  if (tab !== "codes") params.set("tab", tab);
  if (filters.query) params.set("query", filters.query);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.duration) params.set("duration", filters.duration);
  if (filters.status) params.set("status", filters.status);
  if (filters.redeemed) params.set("redeemed", filters.redeemed);
  if (filters.deleted) params.set("deleted", filters.deleted);
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (sort !== "created_at") params.set("sort", sort);
  if (order !== "desc") params.set("order", order);
  if (page !== 1) params.set("page", String(page));
  if (pageSize !== 50) params.set("pageSize", String(pageSize));

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export const LICENSE_CODE_SELECT =
  "id,batch_id,label,trial_days,duration_kind,channel_type,channel_note,code_mask,max_redemptions,redemption_count,is_active,created_at,deleted_at,updated_by,created_by";

type LicenseQueryClient = {
  from: (table: string) => unknown;
};

function applyFilter(query: unknown, method: string, ...args: unknown[]) {
  const candidate = query as Record<string, (...values: unknown[]) => unknown>;
  return typeof candidate[method] === "function" ? candidate[method](...args) : query;
}

export async function getAdminLicenseCodesPage<T>({
  filters,
  order,
  page,
  pageSize,
  sort,
  supabase,
}: {
  filters: AdminLicenseFilters;
  order: AdminLicenseOrder;
  page: number;
  pageSize: number;
  sort: AdminLicenseSort;
  supabase: LicenseQueryClient;
}): Promise<{ currentPage: number; rows: T[]; totalCount: number; totalPages: number }> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  let query = applyFilter(supabase.from("trial_codes"), "select", LICENSE_CODE_SELECT, { count: "exact" });

  if (filters.query) {
    const escaped = filters.query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = applyFilter(query, "or", `id.ilike.%${escaped}%,label.ilike.%${escaped}%,code_mask.ilike.%${escaped}%,channel_note.ilike.%${escaped}%`);
  }
  if (filters.channel) query = applyFilter(query, "eq", "channel_type", filters.channel);
  if (filters.duration) query = applyFilter(query, "eq", "duration_kind", filters.duration);
  if (filters.status === "active") query = applyFilter(query, "eq", "is_active", true);
  if (filters.status === "inactive") query = applyFilter(query, "eq", "is_active", false);
  if (filters.deleted === "deleted") query = applyFilter(query, "not", "deleted_at", "is", null);
  if (filters.deleted === "current" || !filters.deleted) query = applyFilter(query, "is", "deleted_at", null);
  if (filters.redeemed === "redeemed") query = applyFilter(query, "gte", "redemption_count", 1);
  if (filters.redeemed === "unredeemed") query = applyFilter(query, "eq", "redemption_count", 0);
  if (filters.createdFrom) query = applyFilter(query, "gte", "created_at", filters.createdFrom);
  if (filters.createdTo) query = applyFilter(query, "lte", "created_at", `${filters.createdTo}T23:59:59.999Z`);

  query = applyFilter(query, "order", sort, { ascending: order === "asc" });
  const ranged = applyFilter(query, "range", start, end) as Promise<{ count?: number | null; data?: T[] | null; error?: Error | null }>;
  const result = await ranged;

  if (result.error) {
    throw result.error;
  }

  const totalCount = result.count ?? result.data?.length ?? 0;
  return {
    currentPage: page,
    rows: result.data ?? [],
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

const cloudSyncUsageEventLabels: Record<string, string> = {
  activate_conflict: "Device conflict",
  activate_success: "Sync activated",
  cooldown_waiting: "Cooldown waiting",
  heartbeat: "Sync heartbeat",
  release: "Device released sync",
};

export function getCloudSyncUsageEventLabel(eventType: string) {
  return cloudSyncUsageEventLabels[eventType] ?? eventType;
}
