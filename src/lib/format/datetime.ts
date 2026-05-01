export function formatDateTimeWithSeconds(value: string | null, locale: string, timeZone = "UTC") {
  if (!value) {
    return "";
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));

  return formatted.replace("24:", "00:");
}
