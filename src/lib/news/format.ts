export function splitNewsBody(body: string) {
  return body.replaceAll("\\n", "\n").split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function formatNewsDate(value: string | null, locale: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}
