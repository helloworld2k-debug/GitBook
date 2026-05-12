import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRegistrationBlock, revokeRegistrationBlock } from "@/app/[locale]/admin/actions/registration-security";

const mocks = vi.hoisted(() => ({
  insertAdminAuditLog: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
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

describe("registration security admin actions", () => {
  beforeEach(() => {
    mocks.insertAdminAuditLog.mockReset().mockResolvedValue(undefined);
    mocks.redirect.mockClear();
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
    mocks.revalidatePath.mockClear();
    mocks.supabase.from.mockReset();
  });

  it("creates a temporary registration block and audits it", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "registration_blocks") return { insert };
      throw new Error(`Unexpected table: ${table}`);
    });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("scope", "domain");
    formData.set("scope_value", "example.com");
    formData.set("duration", "24h");
    formData.set("reason", "Disposable mailbox abuse");

    await expect(createRegistrationBlock(formData)).rejects.toThrow("redirect:/en/admin/registration-security?notice=registration-block-created");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      created_by: "admin-1",
      reason: "Disposable mailbox abuse",
      scope: "domain",
      scope_value: "example.com",
    }));
    expect(mocks.insertAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "create_registration_block",
      adminUserId: "admin-1",
      targetId: "domain:example.com",
      targetType: "registration_block",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/admin/registration-security");
  });

  it("revokes an active registration block and audits it", async () => {
    const updateEq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateEq }));
    const single = vi.fn(async () => ({
      data: { id: "block-1", scope: "ip", scope_value: "203.0.113.10", blocked_until: "2026-05-12T10:00:00.000Z" },
      error: null,
    }));
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "registration_blocks") {
        return {
          select: () => ({ eq: () => ({ single }) }),
          update,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("block_id", "block-1");
    formData.set("reason", "False positive");

    await expect(revokeRegistrationBlock(formData)).rejects.toThrow("redirect:/en/admin/registration-security?notice=registration-block-revoked");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      revoked_by: "admin-1",
      revoked_reason: "False positive",
    }));
    expect(updateEq).toHaveBeenCalledWith("id", "block-1");
    expect(mocks.insertAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "revoke_registration_block",
      targetId: "block-1",
      targetType: "registration_block",
    }));
  });
});
