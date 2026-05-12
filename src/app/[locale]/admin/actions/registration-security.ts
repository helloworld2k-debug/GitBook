"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import { getBoundedString, getRequiredString, getSafeLocale, MAX_REASON_LENGTH } from "./validation";

type RegistrationBlockScope = "domain" | "email" | "ip";

const durations = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;

function getScope(formData: FormData): RegistrationBlockScope {
  const scope = getRequiredString(formData, "scope", "Scope is required");

  if (scope !== "ip" && scope !== "email" && scope !== "domain") {
    throw new Error("Scope is invalid");
  }

  return scope;
}

function normalizeScopeValue(scope: RegistrationBlockScope, value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized.length > 320) {
    throw new Error("Block value is required");
  }

  if (scope === "email" && !normalized.includes("@")) {
    throw new Error("Email block value must be an email address");
  }

  if (scope === "domain" && (normalized.includes("@") || !normalized.includes("."))) {
    throw new Error("Domain block value must be a domain");
  }

  return normalized;
}

function getBlockedUntil(formData: FormData) {
  const duration = getRequiredString(formData, "duration", "Duration is required");

  if (!(duration in durations)) {
    throw new Error("Duration is invalid");
  }

  return new Date(Date.now() + durations[duration as keyof typeof durations]).toISOString();
}

export async function createRegistrationBlock(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const scope = getScope(formData);
  const scopeValue = normalizeScopeValue(scope, getRequiredString(formData, "scope_value", "Block value is required"));
  const reason = getBoundedString(formData, "reason", "Reason is required", MAX_REASON_LENGTH);
  const blockedUntil = getBlockedUntil(formData);
  const { error } = await createSupabaseAdminClient().from("registration_blocks").insert({
    blocked_until: blockedUntil,
    created_by: admin.id,
    reason,
    scope,
    scope_value: scopeValue,
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/registration-security",
      formData,
      key: "registration-block-create-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "create_registration_block",
    adminUserId: admin.id,
    after: { blocked_until: blockedUntil, reason, scope, scope_value: scopeValue },
    reason,
    targetId: `${scope}:${scopeValue}`,
    targetType: "registration_block",
  });

  revalidatePath(`/${locale}/admin/registration-security`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/registration-security",
    formData,
    key: "registration-block-created",
    locale,
    tone: "notice",
  });
}

export async function revokeRegistrationBlock(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const blockId = getRequiredString(formData, "block_id", "Block is required");
  const reason = getBoundedString(formData, "reason", "Reason is required", MAX_REASON_LENGTH);
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("registration_blocks")
    .select("id,scope,scope_value,blocked_until")
    .eq("id", blockId)
    .single();
  const { error } = await supabase
    .from("registration_blocks")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: admin.id,
      revoked_reason: reason,
    })
    .eq("id", blockId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/registration-security",
      formData,
      key: "registration-block-revoke-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "revoke_registration_block",
    adminUserId: admin.id,
    after: { revoked_by: admin.id, revoked_reason: reason },
    before: before ?? null,
    reason,
    targetId: blockId,
    targetType: "registration_block",
  });

  revalidatePath(`/${locale}/admin/registration-security`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/registration-security",
    formData,
    key: "registration-block-revoked",
    locale,
    tone: "notice",
  });
}
