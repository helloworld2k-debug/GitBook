import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/admin/users/export/route";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("admin users export route", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.createSupabaseAdminClient.mockReset();
  });

  it("exports AI test account type labels and forwards the type filter", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          users: [
            {
              id: "user-1",
              email: "codex-full-1770000000000@example.test",
              display_name: "Codex Test",
              admin_role: "user",
              account_status: "active",
              account_type: "ai_test",
              is_admin: false,
              created_at: "2026-05-01T00:00:00.000Z",
            },
          ],
        },
      ],
      error: null,
    }));
    mocks.createSupabaseAdminClient.mockReturnValue({ rpc });

    const response = await GET(
      new NextRequest("https://gitbookai.example/api/admin/users/export?locale=en&type=ai_test"),
    );
    const csv = await response.text();

    expect(mocks.requireAdmin).toHaveBeenCalledWith("en", "/en/admin/users");
    expect(rpc).toHaveBeenCalledWith("get_admin_users_paginated", expect.objectContaining({
      input_type_filter: "ai_test",
    }));
    expect(csv).toContain('"AI Test"');
    expect(csv).not.toContain('"Standard"');
  });
});
