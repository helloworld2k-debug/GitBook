import { describe, expect, it, vi } from "vitest";
import { updatePolicyPage } from "@/app/[locale]/admin/actions/policies";

const mocks = vi.hoisted(() => ({
  insertAdminAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  requireAdmin: vi.fn(),
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mocks.supabase,
}));

vi.mock("@/app/[locale]/admin/actions/audit", () => ({
  insertAdminAuditLog: mocks.insertAdminAuditLog,
}));

describe("updatePolicyPage", () => {
  it("updates a policy page, writes audit, and revalidates public/admin paths", async () => {
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    const single = vi.fn(async () => ({
      data: { body: "Old body", slug: "terms", summary: "Old summary", title: "Old title" },
      error: null,
    }));
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "policy_pages") {
        return {
          select: () => ({ eq: () => ({ single }) }),
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("return_to", "/admin/policies");
    formData.set("slug", "terms");
    formData.set("title", "Terms of Service");
    formData.set("summary", "Updated summary");
    formData.set("body", "Updated policy body");

    await expect(updatePolicyPage(formData)).rejects.toThrow("redirect:/en/admin/policies?notice=policy-page-updated");

    expect(update).toHaveBeenCalledWith({
      body: "Updated policy body",
      summary: "Updated summary",
      title: "Terms of Service",
      updated_at: expect.any(String),
      updated_by: "admin-1",
    });
    expect(mocks.insertAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "update_policy_page",
      adminUserId: "admin-1",
      targetId: "11111111-1111-1111-1111-111111111111",
      targetType: "policy_page",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/policies/terms");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/policies");
  });
});
