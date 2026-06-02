export const ADMIN_TIME_ZONE = "Asia/Shanghai";

function normalizeMidnight(value: string) {
  return value.replace("24:", "00:");
}

export function formatAdminDate(value: string | null, locale: string, fallback = "-") {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
  }).format(new Date(value));
}

export function formatAdminDateTime(value: string | null, locale: string, fallback = "-") {
  if (!value) {
    return fallback;
  }

  return normalizeMidnight(new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: ADMIN_TIME_ZONE,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value)));
}

export function formatDateTimeWithSeconds(value: string | null, locale: string, timeZone = ADMIN_TIME_ZONE) {
  if (!value) {
    return "";
  }

  return normalizeMidnight(new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value)));
}
