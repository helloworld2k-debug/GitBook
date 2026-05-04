import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";

export type AdminFeedbackTone = "error" | "notice";

export type AdminFeedbackKey =
  | "account-profile-updated"
  | "certificate-revoked"
  | "cloud-sync-lease-revoked"
  | "cloud-sync-lease-revoke-failed"
  | "desktop-session-revoked"
  | "desktop-session-revoke-failed"
  | "feedback-replied"
  | "feedback-reply-failed"
  | "feedback-updated"
  | "feedback-update-failed"
  | "manual-donation-added"
  | "manual-donation-failed"
  | "notification-created"
  | "notification-published"
  | "notification-unpublished"
  | "operation-failed"
  | "profile-update-failed"
  | "release-created"
  | "release-updated"
  | "role-updated"
  | "role-update-failed"
  | "status-updated"
  | "status-update-failed"
  | "trial-code-created"
  | "trial-code-create-failed"
  | "trial-code-deleted"
  | "trial-code-delete-failed"
  | "trial-code-status-updated"
  | "trial-code-status-update-failed"
  | "trial-code-updated"
  | "trial-code-update-failed"
  | "trial-machine-unbound"
  | "trial-machine-unbind-failed";

const adminFeedbackKeys = new Set<string>([
  "account-profile-updated",
  "certificate-revoked",
  "cloud-sync-lease-revoked",
  "cloud-sync-lease-revoke-failed",
  "desktop-session-revoked",
  "desktop-session-revoke-failed",
  "feedback-replied",
  "feedback-reply-failed",
  "feedback-updated",
  "feedback-update-failed",
  "manual-donation-added",
  "manual-donation-failed",
  "notification-created",
  "notification-published",
  "notification-unpublished",
  "operation-failed",
  "profile-update-failed",
  "release-created",
  "release-updated",
  "role-updated",
  "role-update-failed",
  "status-updated",
  "status-update-failed",
  "trial-code-created",
  "trial-code-create-failed",
  "trial-code-deleted",
  "trial-code-delete-failed",
  "trial-code-status-updated",
  "trial-code-status-update-failed",
  "trial-code-updated",
  "trial-code-update-failed",
  "trial-machine-unbound",
  "trial-machine-unbind-failed",
]);

export function isAdminFeedbackKey(value: string | null | undefined): value is AdminFeedbackKey {
  return Boolean(value && adminFeedbackKeys.has(value));
}

export function sanitizeAdminReturnTo(locale: Locale | string, returnTo: FormDataEntryValue | null, fallbackPath: string) {
  const safeLocale = supportedLocales.includes(locale as Locale) ? locale : "en";
  const fallback = fallbackPath.startsWith("/admin") ? fallbackPath : "/admin";
  const value = String(returnTo ?? "").trim();

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return `/${safeLocale}${fallback}`;
  }

  if (!value.startsWith("/admin") || value.startsWith("/api") || value.startsWith("/_next") || value.includes("\\") || value.includes("\n")) {
    return `/${safeLocale}${fallback}`;
  }

  return `/${safeLocale}${value}`;
}

export function redirectWithAdminFeedback(input: {
  fallbackPath: string;
  formData: FormData;
  key: AdminFeedbackKey;
  locale: Locale | string;
  tone: AdminFeedbackTone;
}): never {
  const destination = sanitizeAdminReturnTo(input.locale, input.formData.get("return_to"), input.fallbackPath);
  const url = new URL(destination, "https://admin.local");

  url.searchParams.set(input.tone, input.key);

  redirect(`${url.pathname}${url.search}`);
}
