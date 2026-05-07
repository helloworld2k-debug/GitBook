import type { Json } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function insertAdminAuditLog(input: {
  action: string;
  adminUserId: string;
  after?: Json;
  before?: Json;
  reason: string;
  targetId: string;
  targetType: string;
}) {
  const { error } = await createSupabaseAdminClient().from("admin_audit_logs").insert({
    action: input.action,
    admin_user_id: input.adminUserId,
    after: input.after ?? null,
    before: input.before ?? null,
    reason: input.reason,
    target_id: input.targetId,
    target_type: input.targetType,
  });

  if (error) {
    throw new Error("Unable to write audit log");
  }
}
