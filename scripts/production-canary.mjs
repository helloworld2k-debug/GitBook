import dns from "node:dns/promises";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile, runAccountTypeCheck } from "./production-schema-check.mjs";

const DEFAULT_BASE_URL = "https://gitbookai.ccwu.cc";
const baseUrl = (process.env.CANARY_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const requiredPaths = [
  "/en",
  "/zh-Hant",
  "/ja",
  "/ko",
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

function isUnexpectedPageBody(html) {
  return /NEXT_HTTP_ERROR_FALLBACK;404|Application error|Internal Server Error|This page couldn't load|This page you&apos;re looking for doesn&apos;t exist|This page you're looking for doesn't exist/i.test(html);
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
  try {
    const response = await fetchText(path);
    const title = getTitle(response.text);

    return {
      label: `page ${path}`,
      ok: response.ok && title === "GitBook AI" && !isUnexpectedPageBody(response.text),
      status: response.status,
      title,
      url: response.url,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      label: `page ${path}`,
      ok: false,
      path,
    };
  }
}

async function checkDownload(link) {
  const headers = {
    "user-agent": "GitBookAI-canary/1.0",
  };
  const fetchWithTimeout = async ({ method, redirect }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      return await fetch(link.href, {
        headers,
        method,
        redirect,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const linkUrl = new URL(link.href);
    const isExternal = linkUrl.origin !== new URL(baseUrl).origin;
    let method = isExternal ? "GET" : "HEAD";
    let redirect = isExternal ? "manual" : "follow";
    let response = await fetchWithTimeout({ method, redirect });

    if (!isExternal && !response.ok) {
      method = "GET";
      redirect = "follow";
      response = await fetchWithTimeout({ method, redirect });
    }

    return {
      contentLength: response.headers.get("content-length"),
      contentType: response.headers.get("content-type"),
      label: `download ${link.label}`,
      method,
      ok: isExternal ? response.status >= 200 && response.status < 400 : response.ok,
      redirect,
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

async function checkDownloadLinks(links) {
  const checksByHref = new Map();

  for (const link of links) {
    if (!checksByHref.has(link.href)) {
      checksByHref.set(link.href, await checkDownload(link));
    }
  }

  return links.map((link) => ({
    ...checksByHref.get(link.href),
    label: `download ${link.label}`,
  }));
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

async function fetchDebugWebhookStatus() {
  const response = await fetch(`${baseUrl}/api/debug/webhook-status`);
  const data = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;

  return { data, response };
}

async function checkDodoLiveProducts() {
  const { data, response } = await fetchDebugWebhookStatus();
  const env = data?.env ?? {};
  const requiredProductKeys = [
    "DODO_LIVE_PRODUCT_ONE_DAY",
    "DODO_LIVE_PRODUCT_MONTHLY",
    "DODO_LIVE_PRODUCT_QUARTERLY",
    "DODO_LIVE_PRODUCT_YEARLY",
  ];
  const missing = requiredProductKeys.filter((key) => env[key] !== "已设置");

  return {
    environment: env.DODO_PAYMENTS_ENV,
    label: "Dodo live product config",
    missing,
    ok: response.ok && env.DODO_PAYMENTS_ENV === "live" && missing.length === 0,
    status: response.status,
  };
}

async function checkProductionSchema() {
  const response = await fetch(`${baseUrl}/api/debug/webhook-status`);
  const data = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;
  const accountTypeStatus = data?.schemaStatus?.profiles_account_type ?? {};

  if (accountTypeStatus.status) {
    return {
      code: accountTypeStatus.code ?? null,
      label: "schema profiles.account_type",
      ok: response.ok && accountTypeStatus.status === "pass",
      source: "debug webhook status",
      status: response.status,
    };
  }

  const env = { ...process.env, ...loadEnvFile(".env.local") };

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      label: "schema profiles.account_type",
      ok: false,
      source: "debug webhook status",
      status: response.status,
    };
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const summary = await runAccountTypeCheck(supabase);

  return {
    code: summary.accountType.code,
    label: "schema profiles.account_type",
    ok: summary.status === "pass",
    source: "supabase direct",
    status: summary.accountType.status,
  };
}

async function checkContributionsAnonymousEntry() {
  const response = await fetchText("/en/contributions");
  const hasLoginEntry = response.text.includes("/en/login?next=%2Fen%2Fcontributions");
  const exposesCheckoutForm = response.text.includes('action="/api/checkout/dodo"');

  return {
    label: "contributions anonymous entry",
    ok: response.ok && hasLoginEntry && !exposesCheckoutForm && !isUnexpectedPageBody(response.text),
    path: "/en/contributions",
    protected: hasLoginEntry,
    status: response.status,
    url: response.url,
  };
}

async function checkAdminEntry() {
  const response = await fetchText("/en/admin/users");
  const hasLoginProtection = response.text.includes("login-email") ||
    response.text.includes("/auth/callback") ||
    response.text.includes("/en/login?next=%2Fen%2Fadmin%2Fusers") ||
    response.url.includes("/en/login");
  const exposesAdminContent = response.text.includes("User management") ||
    response.text.includes("Account type");

  return {
    label: "admin users anonymous protection",
    ok: response.ok && hasLoginProtection && !exposesAdminContent && !isUnexpectedPageBody(response.text),
    path: "/en/admin/users",
    protected: hasLoginProtection,
    status: response.status,
    url: response.url,
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
  checks.push(...await checkDownloadLinks(downloadLinks));
  checks.push(await checkAuthCallback());
  checks.push(await checkDebugWebhookStatus());
  checks.push(await checkDodoLiveProducts());
  checks.push(await checkContributionsAnonymousEntry());
  checks.push(await checkProductionSchema());
  checks.push(await checkAdminEntry());
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
