import { describe, expect, it } from "vitest";
import {
  getCloudSyncUsageEventLabel,
  parseAdminLicenseSearchParams,
} from "@/lib/admin/license-management";

describe("admin license management helpers", () => {
  it("normalizes tab, paging, filters, and sorting from URL params", () => {
    const parsed = parseAdminLicenseSearchParams({
      channel: "taobao",
      createdFrom: "2026-05-01",
      createdTo: "2026-05-23",
      deleted: "current",
      duration: "month_1",
      order: "asc",
      page: "3",
      pageSize: "100",
      query: "may",
      redeemed: "unredeemed",
      sort: "redemption_count",
      status: "active",
      tab: "codes",
    });

    expect(parsed).toEqual({
      tab: "codes",
      filters: {
        channel: "taobao",
        createdFrom: "2026-05-01",
        createdTo: "2026-05-23",
        deleted: "current",
        duration: "month_1",
        query: "may",
        redeemed: "unredeemed",
        status: "active",
      },
      sort: "redemption_count",
      order: "asc",
      page: 3,
      pageSize: 100,
    });
  });

  it("falls back to safe defaults for unsupported URL params", () => {
    const parsed = parseAdminLicenseSearchParams({
      order: "sideways",
      page: "-1",
      pageSize: "999",
      sort: "code_hash",
      tab: "everything",
    });

    expect(parsed.tab).toBe("codes");
    expect(parsed.sort).toBe("created_at");
    expect(parsed.order).toBe("desc");
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
  });

  it("maps cloud sync usage event names to operator-facing labels", () => {
    expect(getCloudSyncUsageEventLabel("release")).toBe("Device released sync");
    expect(getCloudSyncUsageEventLabel("activate_success")).toBe("Sync activated");
    expect(getCloudSyncUsageEventLabel("activate_conflict")).toBe("Device conflict");
    expect(getCloudSyncUsageEventLabel("cooldown_waiting")).toBe("Cooldown waiting");
    expect(getCloudSyncUsageEventLabel("unexpected_event")).toBe("unexpected_event");
  });
});
