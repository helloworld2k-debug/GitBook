import { redirect } from "next/navigation";
import type { Locale } from "@/config/site";
import { getActionLocale } from "@/lib/i18n/action-locale";

export type AdminFeedbackTone = "error" | "notice";

export type AdminFeedbackKey =
  | "account-profile-updated"
  | "bulk-user-role-updated"
  | "bulk-user-role-update-failed"
  | "bulk-user-status-updated"
  | "bulk-user-status-update-failed"
  | "certificate-revoked"
  | "cloud-sync-cooldown-updated"
  | "cloud-sync-cooldown-update-failed"
  | "cloud-sync-lease-revoked"
  | "cloud-sync-lease-revoke-failed"
  | "cloud-sync-override-granted"
  | "cloud-sync-override-grant-failed"
  | "desktop-session-revoked"
  | "desktop-session-revoke-failed"
  | "donation-tier-updated"
  | "donation-tier-update-failed"
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
  | "support-contact-updated"
  | "support-contact-update-failed"
  | "trial-code-created"
  | "trial-code-create-failed"
  | "license-code-batch-created"
  | "license-code-batch-create-failed"
  | "license-codes-bulk-updated"
  | "license-codes-bulk-update-failed"
  | "trial-code-deleted"
  | "trial-code-delete-failed"
  | "trial-code-status-updated"
  | "trial-code-status-update-failed"
  | "trial-code-updated"
  | "trial-code-update-failed"
  | "trial-machine-unbound"
  | "trial-machine-unbind-failed"
  | "user-permanently-deleted"
  | "user-permanent-delete-failed"
  | "user-soft-deleted"
  | "user-soft-delete-failed";

const adminFeedbackKeys = new Set<string>([
  "account-profile-updated",
  "bulk-user-role-updated",
  "bulk-user-role-update-failed",
  "bulk-user-status-updated",
  "bulk-user-status-update-failed",
  "certificate-revoked",
  "cloud-sync-cooldown-updated",
  "cloud-sync-cooldown-update-failed",
  "cloud-sync-lease-revoked",
  "cloud-sync-lease-revoke-failed",
  "cloud-sync-override-granted",
  "cloud-sync-override-grant-failed",
  "desktop-session-revoked",
  "desktop-session-revoke-failed",
  "donation-tier-updated",
  "donation-tier-update-failed",
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
  "support-contact-updated",
  "support-contact-update-failed",
  "trial-code-created",
  "trial-code-create-failed",
  "license-code-batch-created",
  "license-code-batch-create-failed",
  "license-codes-bulk-updated",
  "license-codes-bulk-update-failed",
  "trial-code-deleted",
  "trial-code-delete-failed",
  "trial-code-status-updated",
  "trial-code-status-update-failed",
  "trial-code-updated",
  "trial-code-update-failed",
  "trial-machine-unbound",
  "trial-machine-unbind-failed",
  "user-permanently-deleted",
  "user-permanent-delete-failed",
  "user-soft-deleted",
  "user-soft-delete-failed",
]);

export function isAdminFeedbackKey(value: string | null | undefined): value is AdminFeedbackKey {
  return Boolean(value && adminFeedbackKeys.has(value));
}

export function sanitizeAdminReturnTo(locale: Locale | string, returnTo: FormDataEntryValue | null, fallbackPath: string) {
  const safeLocale = getActionLocale(locale);
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
