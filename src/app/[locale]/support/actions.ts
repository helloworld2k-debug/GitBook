"use server";

import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const subject = getRequiredString(formData, "subject", "Subject is required", MAX_SUBJECT_LENGTH);
  const message = getRequiredString(formData, "message", "Message is required", MAX_MESSAGE_LENGTH);
  const email = getOptionalString(formData, "email", MAX_CONTACT_LENGTH);
  const contact = getOptionalString(formData, "contact", MAX_CONTACT_LENGTH);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const { error } = await createSupabaseAdminClient().from("support_feedback").insert({
    contact,
    email: email || data.user?.email || null,
    message,
    subject,
    user_id: data.user?.id ?? null,
  });

  if (error) {
    redirect(`/${safeLocale}/support?feedback=error`);
  }

  redirect(`/${safeLocale}/support?feedback=saved`);
}
