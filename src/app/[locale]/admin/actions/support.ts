"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import { feedbackStatuses, getBoundedString, getPositiveInteger, getRequiredString, getSafeLocale, getSupportContactChannelId, MAX_NOTIFICATION_BODY_LENGTH, validateSupportContactValue } from "./validation";

export async function updateSupportContactChannel(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const channelId = getSupportContactChannelId(formData);
  const value = String(formData.get("value") ?? "").trim();
  const label = getRequiredString(formData, "label", "Label is required");
  const sortOrder = getPositiveInteger(formData, "sort_order", "Sort order must be a positive integer");
  const isEnabled = formData.get("is_enabled") === "on";

  validateSupportContactValue(channelId, value);

  const supabase = createSupabaseAdminClient();
  const { data: existingChannel } = await supabase
    .from("support_contact_channels")
    .select("id")
    .eq("id", channelId)
    .single();

  const { error } = await supabase
    .from("support_contact_channels")
    .upsert({
      id: channelId,
      is_enabled: isEnabled,
      label,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
      value,
    }, { onConflict: "id" });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-settings",
      formData,
      key: "support-contact-update-failed",
      locale,
      tone: "error",
    });
  }

  if (existingChannel?.id === channelId) {
    await insertAdminAuditLog({
      action: "update_support_contact_channel",
      adminUserId: admin.id,
      after: { channel_id: channelId, is_enabled: isEnabled, label, sort_order: sortOrder, value },
      reason: `Updated support contact channel ${channelId}`,
      targetId: "11111111-1111-1111-1111-111111111111",
      targetType: "support_contact_channel",
    });
  }

  revalidatePath(`/${locale}/support`);
  revalidatePath(`/${locale}/admin/support-settings`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-settings",
    formData,
    key: "support-contact-updated",
    locale,
    tone: "notice",
  });
}

export async function updateSupportFeedbackStatus(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const feedbackId = getRequiredString(formData, "feedback_id", "Feedback is required");
  const status = getRequiredString(formData, "status", "Status is required");

  if (!feedbackStatuses.includes(status as (typeof feedbackStatuses)[number])) {
    throw new Error("Invalid feedback status");
  }

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("support_feedback")
    .select("status")
    .eq("id", feedbackId)
    .single();
  const { error } = await supabase
    .from("support_feedback")
    .update({
      closed_at: status === "closed" ? new Date().toISOString() : null,
      status: status as (typeof feedbackStatuses)[number],
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-feedback",
      formData,
      key: "feedback-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_support_feedback_status",
    adminUserId: admin.id,
    after: { status },
    before: before ?? null,
    reason: `Updated support feedback status to ${status}`,
    targetId: feedbackId,
    targetType: "support_feedback",
  });

  revalidatePath(`/${locale}/admin/support-feedback`);
  revalidatePath(`/${locale}/admin/support-feedback/${feedbackId}`);
  revalidatePath(`/${locale}/support/feedback/${feedbackId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-feedback",
    formData,
    key: "feedback-updated",
    locale,
    tone: "notice",
  });
}

export async function replySupportFeedbackAsAdmin(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const feedbackId = getRequiredString(formData, "feedback_id", "Feedback is required");
  const message = getBoundedString(formData, "message", "Message is required", MAX_NOTIFICATION_BODY_LENGTH);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("support_feedback_messages").insert({
    admin_user_id: admin.id,
    author_role: "admin",
    body: message,
    feedback_id: feedbackId,
  });

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/support-feedback/${feedbackId}`,
      formData,
      key: "feedback-reply-failed",
      locale,
      tone: "error",
    });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("support_feedback")
    .update({ status: "reviewing", updated_at: now })
    .eq("id", feedbackId);

  if (updateError) {
    redirectWithAdminFeedback({
      fallbackPath: `/admin/support-feedback/${feedbackId}`,
      formData,
      key: "feedback-reply-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "reply_support_feedback",
    adminUserId: admin.id,
    reason: "Admin replied to support feedback",
    targetId: feedbackId,
    targetType: "support_feedback",
  });

  revalidatePath(`/${locale}/admin/support-feedback`);
  revalidatePath(`/${locale}/admin/support-feedback/${feedbackId}`);
  revalidatePath(`/${locale}/support/feedback/${feedbackId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: `/admin/support-feedback/${feedbackId}`,
    formData,
    key: "feedback-replied",
    locale,
    tone: "notice",
  });
}
