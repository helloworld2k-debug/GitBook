import dns from "node:dns/promises";

const DEFAULT_BASE_URL = "https://gitbookai.ccwu.cc";
const baseUrl = (process.env.CANARY_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const requiredPaths = [
  "/en",
  "/zh-Hant",
  "/ja",
  "/ko",
  "/en/versions",
  "/en/contributions",
  "/en/support",
  "/en/news",
  "/en/login",
];

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getTitle(html) {
  return stripTags(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? "");
}

function getDownloadLinks(html) {
  const links = [];

  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis)) {
    const label = stripTags(match[2]);

    if (/Download for|macOS|Windows/i.test(label)) {
      links.push({
        href: new URL(match[1], baseUrl).toString(),
        label,
      });
    }
  }

  return links;
}

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "follow",
  });
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    text,
    url: response.url,
  };
}

async function checkPage(path) {
  const response = await fetchText(path);
  const title = getTitle(response.text);

  return {
    label: `page ${path}`,
    ok: response.ok && title === "GitBook AI",
    status: response.status,
    title,
    url: response.url,
  };
}

async function checkDownload(link) {
  try {
    const response = await fetch(link.href, {
      method: "HEAD",
      redirect: "follow",
    });

    return {
      contentLength: response.headers.get("content-length"),
      contentType: response.headers.get("content-type"),
      label: `download ${link.label}`,
      ok: response.ok,
      status: response.status,
      url: response.url,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      label: `download ${link.label}`,
      ok: false,
      url: link.href,
    };
  }
}

async function checkWww() {
  const wwwUrl = new URL(baseUrl);
  wwwUrl.hostname = `www.${wwwUrl.hostname}`;
  wwwUrl.pathname = "/en";

  try {
    const response = await fetch(wwwUrl, {
      redirect: "manual",
    });

    return {
      label: "www domain",
      location: response.headers.get("location"),
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      url: wwwUrl.toString(),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      label: "www domain",
      ok: false,
      url: wwwUrl.toString(),
    };
  }
}

async function checkAuthCallback() {
  const response = await fetch(`${baseUrl}/auth/callback`, {
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";

  return {
    label: "auth callback missing-code redirect",
    location,
    ok: response.status === 307 && location.includes("/en/login?error=missing-code"),
    status: response.status,
  };
}

async function checkDebugWebhookStatus() {
  const response = await fetch(`${baseUrl}/api/debug/webhook-status`);
  const data = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;
  const env = data?.env ?? {};

  return {
    dodoEnvironment: env.DODO_PAYMENTS_ENV,
    label: "Dodo webhook config",
    ok: response.ok &&
      env.NEXT_PUBLIC_SITE_URL === baseUrl &&
      env.DODO_PAYMENTS_API_KEY === "已设置" &&
      env.DODO_PAYMENTS_WEBHOOK_KEY === "已设置",
    status: response.status,
  };
}

async function main() {
  const checks = [];
  const hostname = new URL(baseUrl).hostname;

  try {
    const records = await dns.resolve4(hostname);
    checks.push({
      label: "apex DNS",
      ok: records.length > 0,
      records,
    });
  } catch (error) {
    checks.push({
      error: error instanceof Error ? error.message : String(error),
      label: "apex DNS",
      ok: false,
    });
  }

  checks.push(...await Promise.all(requiredPaths.map(checkPage)));

  const home = await fetchText("/en");
  const downloadLinks = getDownloadLinks(home.text);
  checks.push({
    count: downloadLinks.length,
    label: "download link discovery",
    ok: downloadLinks.length >= 2,
  });
  checks.push(...await Promise.all(downloadLinks.map(checkDownload)));
  checks.push(await checkAuthCallback());
  checks.push(await checkDebugWebhookStatus());
  checks.push(await checkWww());

  const failed = checks.filter((check) => !check.ok);

  console.log(JSON.stringify({
    baseUrl,
    checkedAt: new Date().toISOString(),
    checks,
    failed: failed.map((check) => check.label),
    status: failed.length > 0 ? "fail" : "pass",
  }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
