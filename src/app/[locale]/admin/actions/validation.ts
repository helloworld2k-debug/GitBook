import { getActionLocale } from "@/lib/i18n/action-locale";

export const MAX_REASON_LENGTH = 500;
export const MAX_MANUAL_REFERENCE_LENGTH = 120;
export const MAX_RELEASE_NOTES_LENGTH = 4000;
export const MAX_TRIAL_LABEL_LENGTH = 120;
export const MAX_TRIAL_DAYS = 7;
export const MAX_LICENSE_BATCH_QUANTITY = 10;
export const MAX_NOTIFICATION_TITLE_LENGTH = 160;
export const MAX_NOTIFICATION_BODY_LENGTH = 4000;
export const MAX_DONATION_TIER_LABEL_LENGTH = 120;
export const MAX_DONATION_TIER_DESCRIPTION_LENGTH = 500;
export const notificationAudiences = ["all", "authenticated", "admins"] as const;
export const notificationPriorities = ["info", "success", "warning", "critical"] as const;
export const feedbackStatuses = ["open", "reviewing", "closed"] as const;
export const supportContactChannelIds = ["telegram", "discord", "qq", "email", "wechat"] as const;
export const licenseCodeDurationKinds = ["trial_3_day", "month_1", "month_3", "year_1"] as const;
export const licenseCodeChannelTypes = ["internal", "taobao", "xianyu", "partner", "other"] as const;

export function getSafeLocale(locale: FormDataEntryValue | null) {
  return getActionLocale(locale);
}

export function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function getUserIds(formData: FormData) {
  const values = formData.getAll("user_ids").map((value) => String(value).trim()).filter(Boolean);

  if (values.length === 0) {
    throw new Error("At least one user is required");
  }

  return [...new Set(values)];
}

export function getPositiveInteger(formData: FormData, key: string, message: string) {
  const value = Number(formData.get(key));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

export function getPositiveDollarAmountInCents(formData: FormData, key: string, message: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const value = Number(rawValue);

  if (!rawValue || !Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }

  return Math.round(value * 100);
}

export function getDiscountPercent(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "0").trim();
  const value = rawValue ? Number(rawValue) : 0;

  if (!Number.isInteger(value) || value < 0 || value >= 100) {
    throw new Error("Discount must be an integer from 0 to 99");
  }

  return value;
}

export function getTrialDays(formData: FormData) {
  const value = getPositiveInteger(formData, "trial_days", "Trial days must be between 1 and 7");

  if (value > MAX_TRIAL_DAYS) {
    throw new Error("Trial days must be between 1 and 7");
  }

  return value;
}

export function getLicenseCodeDurationKind(formData: FormData) {
  const value = String(formData.get("duration_kind") ?? "").trim();

  if (!licenseCodeDurationKinds.includes(value as (typeof licenseCodeDurationKinds)[number])) {
    throw new Error("License code duration is required");
  }

  return value as (typeof licenseCodeDurationKinds)[number];
}

export function getLicenseCodeChannelType(formData: FormData) {
  const value = String(formData.get("channel_type") ?? "internal").trim() || "internal";

  if (!licenseCodeChannelTypes.includes(value as (typeof licenseCodeChannelTypes)[number])) {
    throw new Error("License code channel is invalid");
  }

  return value as (typeof licenseCodeChannelTypes)[number];
}

export function getLicenseBatchQuantity(formData: FormData) {
  const value = getPositiveInteger(formData, "quantity", "License code batch quantity must be between 1 and 10");

  if (value > MAX_LICENSE_BATCH_QUANTITY) {
    throw new Error("License code batch quantity must be between 1 and 10");
  }

  return value;
}

export function getOptionalDateIso(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return date.toISOString();
}

export function getRequiredReason(formData: FormData) {
  const reason = getRequiredString(formData, "reason", "Reason is required");

  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error("Reason must be 500 characters or fewer");
  }

  return reason;
}

export function getBoundedString(formData: FormData, key: string, message: string, maxLength: number) {
  const value = getRequiredString(formData, key, message);

  if (value.length > maxLength) {
    throw new Error(`${message} must be ${maxLength} characters or fewer`);
  }

  return value;
}

export function getManualReference(formData: FormData) {
  const reference = getRequiredString(formData, "reference", "Reference is required");

  if (reference.length > MAX_MANUAL_REFERENCE_LENGTH) {
    throw new Error("Reference must be 120 characters or fewer");
  }

  return `manual_${reference.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
}

export function getReleaseDate(formData: FormData) {
  const date = getRequiredString(formData, "released_at", "Release date is required");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Release date must use YYYY-MM-DD");
  }

  return date;
}

export function getReleaseNotes(formData: FormData) {
  const notes = String(formData.get("notes") ?? "").trim();

  if (notes.length > MAX_RELEASE_NOTES_LENGTH) {
    throw new Error("Release notes must be 4000 characters or fewer");
  }

  return notes || null;
}

export function getUploadFile(formData: FormData, key: string) {
  const file = formData.get(key);

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  return file;
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/\s+/g, "-");
}

export function getReleaseDeliveryMode(formData: FormData) {
  const deliveryMode = getRequiredString(formData, "delivery_mode", "Delivery mode is required");

  if (deliveryMode !== "file" && deliveryMode !== "link") {
    throw new Error("Invalid delivery mode");
  }

  return deliveryMode as "file" | "link";
}

export function getOptionalReleaseUrl(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Enter a valid URL");
    }
  } catch {
    throw new Error("Enter a valid URL");
  }

  return value;
}

export function getRequiredReleaseUrl(formData: FormData, key: string) {
  const value = getOptionalReleaseUrl(formData, key);

  if (!value) {
    throw new Error("Primary download URL is required");
  }

  return value;
}

export function getSupportContactChannelId(formData: FormData) {
  const channelId = getRequiredString(formData, "channel_id", "Channel is required");

  if (!supportContactChannelIds.includes(channelId as (typeof supportContactChannelIds)[number])) {
    throw new Error("Invalid support contact channel");
  }

  return channelId as (typeof supportContactChannelIds)[number];
}

export function validateSupportContactValue(channelId: (typeof supportContactChannelIds)[number], value: string) {
  if (!value) {
    return;
  }

  if (channelId === "telegram" || channelId === "discord") {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Enter a valid URL");
      }
    } catch {
      throw new Error("Enter a valid URL");
    }
  }

  if (channelId === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error("Enter a valid email address");
    }
  }
}
