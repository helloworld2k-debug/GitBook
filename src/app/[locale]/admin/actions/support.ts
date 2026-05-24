"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import type { AdminInlineActionState } from "@/lib/admin/inline-action";
import { requireAdmin } from "@/lib/auth/guards";
import type { PaymentCheckoutStatus } from "@/lib/payments/maintenance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import { feedbackStatuses, getBoundedString, getPositiveInteger, getRequiredString, getSafeLocale, getSupportContactChannelId, MAX_NOTIFICATION_BODY_LENGTH, validateSupportContactValue } from "./validation";

const paymentMaintenanceTargetId = "22222222-2222-2222-2222-222222222222";
const maxPaymentMaintenanceMessageLength = 280;

type SupportContactChannelInlineData = {
  channel: {
    id: ReturnType<typeof getSupportContactChannelId>;
    is_enabled: boolean;
    label: string;
    sort_order: number;
    value: string;
  };
};

type PaymentMaintenanceInlineData = {
  status: PaymentCheckoutStatus;
};

async function saveSupportContactChannel(formData: FormData) {
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
    return {
      errorKey: "support-contact-update-failed" as const,
      locale,
      ok: false as const,
    };
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

  return {
    channel: {
      id: channelId,
      is_enabled: isEnabled,
      label,
      sort_order: sortOrder,
      value,
    },
    locale,
    ok: true as const,
  };
}

async function savePaymentCheckoutMaintenance(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const isPaused = formData.get("is_paused") === "on";
  const message = getBoundedString(
    formData,
    "message",
    "Maintenance message",
    maxPaymentMaintenanceMessageLength,
  );
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("operational_settings")
    .select("value")
    .eq("key", "payment_checkout")
    .maybeSingle();
  const next = {
    is_paused: isPaused,
    message,
  };
  const { error } = await supabase.from("operational_settings").upsert({
    key: "payment_checkout",
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
    value: next,
  }, { onConflict: "key" });

  if (error) {
    return {
      errorKey: "payment-maintenance-update-failed" as const,
      locale,
      ok: false as const,
    };
  }

  await insertAdminAuditLog({
    action: "update_payment_checkout_maintenance",
    adminUserId: admin.id,
    after: next,
    before: before ?? null,
    reason: isPaused ? "Paused new payment checkout sessions" : "Resumed new payment checkout sessions",
    targetId: paymentMaintenanceTargetId,
    targetType: "operational_setting",
  });

  revalidatePath(`/${locale}/contributions`);
  revalidatePath(`/${locale}/admin/support-settings`);
  revalidatePath(`/${locale}/admin/audit-logs`);

  return {
    locale,
    ok: true as const,
    status: {
      isPaused,
      message,
    },
  };
}

export async function updateSupportContactChannel(formData: FormData) {
  const result = await saveSupportContactChannel(formData);

  if (!result.ok) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-settings",
      formData,
      key: result.errorKey,
      locale: result.locale,
      tone: "error",
    });
  }

  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-settings",
    formData,
    key: "support-contact-updated",
    locale: result.locale,
    tone: "notice",
  });
}

export async function updateSupportContactChannelInline(
  _previousState: AdminInlineActionState<SupportContactChannelInlineData>,
  formData: FormData,
): Promise<AdminInlineActionState<SupportContactChannelInlineData>> {
  try {
    const result = await saveSupportContactChannel(formData);

    if (!result.ok) {
      return {
        key: result.errorKey,
        tone: "error",
      };
    }

    return {
      data: {
        channel: result.channel,
      },
      key: "support-contact-updated",
      tone: "notice",
    };
  } catch (error) {
    return {
      key: "support-contact-update-failed",
      message: error instanceof Error ? error.message : "Unable to update support contact channel.",
      tone: "error",
    };
  }
}

export async function updatePaymentCheckoutMaintenance(formData: FormData) {
  const result = await savePaymentCheckoutMaintenance(formData);

  if (!result.ok) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/support-settings",
      formData,
      key: result.errorKey,
      locale: result.locale,
      tone: "error",
    });
  }

  redirectWithAdminFeedback({
    fallbackPath: "/admin/support-settings",
    formData,
    key: "payment-maintenance-updated",
    locale: result.locale,
    tone: "notice",
  });
}

export async function updatePaymentCheckoutMaintenanceInline(
  _previousState: AdminInlineActionState<PaymentMaintenanceInlineData>,
  formData: FormData,
): Promise<AdminInlineActionState<PaymentMaintenanceInlineData>> {
  try {
    const result = await savePaymentCheckoutMaintenance(formData);

    if (!result.ok) {
      return {
        key: result.errorKey,
        tone: "error",
      };
    }

    return {
      data: {
        status: result.status,
      },
      key: "payment-maintenance-updated",
      tone: "notice",
    };
  } catch (error) {
    return {
      key: "payment-maintenance-update-failed",
      message: error instanceof Error ? error.message : "Unable to update payment maintenance.",
      tone: "error",
    };
  }
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
