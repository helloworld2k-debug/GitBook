"use server";

import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";
import { requireUser } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_SUBJECT_LENGTH = 180;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTACT_LENGTH = 200;

function getSafeLocale(locale: string) {
  return supportedLocales.includes(locale as Locale) ? locale : "en";
}

function getRequiredString(formData: FormData, key: string, message: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  if (value.length > maxLength) {
    throw new Error(message);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return null;
  }

  return value.slice(0, maxLength);
}

export async function submitSupportFeedback(locale: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/support`);
  const subject = getRequiredString(formData, "subject", "Subject is required", MAX_SUBJECT_LENGTH);
  const message = getRequiredString(formData, "message", "Message is required", MAX_MESSAGE_LENGTH);
  const contact = getOptionalString(formData, "contact", MAX_CONTACT_LENGTH);
  const { error } = await createSupabaseAdminClient().from("support_feedback").insert({
    contact,
    email: user.email ?? null,
    message,
    subject,
    user_id: user.id,
  });

  if (error) {
    redirect(`/${safeLocale}/support?feedback=error`);
  }

  redirect(`/${safeLocale}/support?feedback=saved`);
}

export async function replySupportFeedback(locale: string, feedbackId: string, formData: FormData) {
  const safeLocale = getSafeLocale(locale);
  const user = await requireUser(safeLocale, `/${safeLocale}/support/feedback/${feedbackId}`);
  const message = getRequiredString(formData, "message", "Message is required", MAX_MESSAGE_LENGTH);
  const supabase = createSupabaseAdminClient();
  const { data: feedback, error: feedbackError } = await supabase
    .from("support_feedback")
    .select("id,user_id")
    .eq("id", feedbackId)
    .eq("user_id", user.id)
    .single();

  if (feedbackError || !feedback) {
    redirect(`/${safeLocale}/support?feedback=error`);
  }

  const { error: messageError } = await supabase.from("support_feedback_messages").insert({
    author_role: "user",
    body: message,
    feedback_id: feedbackId,
    user_id: user.id,
  });

  if (messageError) {
    redirect(`/${safeLocale}/support/feedback/${feedbackId}?reply=error`);
  }

  await supabase
    .from("support_feedback")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", feedbackId);

  redirect(`/${safeLocale}/support/feedback/${feedbackId}?reply=saved`);
}
