const ALLOWED_LOCALHOSTS = new Set(["localhost:3000", "127.0.0.1:3000", "localhost:3001", "127.0.0.1:3001"]);

function getExpectedOrigins(): string[] {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const origins = siteUrl ? [new URL(siteUrl).origin] : [];

  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return origins;
}

function isAllowedLocalhost(origin: string) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ALLOWED_LOCALHOSTS.has(url.host);
  } catch {
    return false;
  }
}

export function validateRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  if (isAllowedLocalhost(origin)) {
    return true;
  }

  const allowed = getExpectedOrigins();

  return allowed.includes(origin);
}
