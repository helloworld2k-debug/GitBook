import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = "https://gitbookai.ccwu.cc";
const DNS_SERVERS = [
  { label: "AliDNS", server: "223.5.5.5" },
  { label: "DNSPod", server: "119.29.29.29" },
  { label: "114DNS", server: "114.114.114.114" },
  { label: "BaiduDNS", server: "180.76.76.76" },
];
const CHECK_HOST_NODES = [
  "cn1.node.check-host.net",
  "hk1.node.check-host.net",
  "jp1.node.check-host.net",
  "sg1.node.check-host.net",
];
const REQUIRED_PATHS = ["/en", "/zh-Hant", "/en/login", "/en/contributions", "/en/support"];

function stripTags(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

async function run(command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 20,
      timeout: options.timeout ?? 30000,
    });

    return { ok: true, stdout, stderr };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
    };
  }
}

async function fetchJson(url) {
  const result = await run("curl", ["-sS", "--max-time", "25", "-H", "Accept: application/json", url], { timeout: 30000 });

  if (!result.ok) {
    throw new Error(result.stderr || `Unable to fetch ${url}`);
  }

  return JSON.parse(result.stdout);
}

export function classifyExternalUrl(url) {
  let hostname = "";

  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return { level: "low", reason: "Invalid URL ignored by the audit." };
  }

  if (hostname === "github.com" || hostname.endsWith(".github.com") || hostname.endsWith("githubusercontent.com")) {
    return { level: "high", reason: "GitHub is not a reliable download path for mainland China users." };
  }

  if (hostname.includes("google")) {
    return { level: "high", reason: "Google services are not a reliable login path for mainland China users." };
  }

  if (hostname === "discord.gg" || hostname.endsWith(".discord.gg") || hostname.includes("discord.com")) {
    return { level: "high", reason: "Discord is not a reliable support channel for mainland China users." };
  }

  if (hostname === "t.me" || hostname.endsWith(".telegram.org")) {
    return { level: "high", reason: "Telegram is not a reliable support channel for mainland China users." };
  }

  if (hostname.endsWith(".supabase.co")) {
    return { level: "medium", reason: "Supabase Storage should be verified from mainland China nodes." };
  }

  if (hostname.includes("dodopayments.com")) {
    return { level: "medium", reason: "Dodo checkout should be verified with a real checkout session from mainland China nodes." };
  }

  if (hostname.includes("cloudflare.com")) {
    return { level: "medium", reason: "Cloudflare challenge scripts should be verified from mainland China nodes." };
  }

  return { level: "low", reason: "No known mainland China access risk detected." };
}

export function extractDownloadLinks(html, baseUrl = DEFAULT_BASE_URL) {
  const links = [];

  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis)) {
    const label = stripTags(match[2]);

    if (!/download|macos|windows/i.test(label)) {
      continue;
    }

    const href = toAbsoluteUrl(match[1], baseUrl);

    if (href) {
      links.push({ href, label });
    }
  }

  return links;
}

export function normalizeCheckHostNodeResult(value) {
  const row = Array.isArray(value) && Array.isArray(value[0]) ? value[0] : null;

  if (!row) {
    return {
      ip: null,
      ok: false,
      seconds: null,
      statusCode: null,
      statusText: "pending",
    };
  }

  const statusCode = Number.parseInt(String(row[3] ?? ""), 10);

  return {
    ip: row[4] ? String(row[4]) : null,
    ok: row[0] === 1 && statusCode >= 200 && statusCode < 400,
    seconds: typeof row[1] === "number" ? row[1] : null,
    statusCode: Number.isNaN(statusCode) ? null : statusCode,
    statusText: String(row[2] ?? ""),
  };
}

export function createSummary(checks) {
  const failedRequired = checks
    .filter((check) => check.required && check.status === "fail")
    .map((check) => check.label);
  const skippedOptional = checks
    .filter((check) => !check.required && check.status === "skipped")
    .map((check) => check.label);
  const risky = checks.filter((check) => check.status === "risk").length;
  const passed = checks.filter((check) => check.status === "pass").length;

  return {
    failedRequired,
    passed,
    risky,
    skippedOptional,
    status: failedRequired.length > 0 ? "fail" : risky > 0 ? "risk" : "pass",
    total: checks.length,
  };
}

async function fetchText(url) {
  const result = await run("curl", ["-L", "--max-time", "30", "-sS", url], { timeout: 35000 });

  if (!result.ok) {
    throw new Error(result.stderr || `Unable to fetch ${url}`);
  }

  return result.stdout;
}

async function checkDns(domain) {
  const checks = [];

  for (const dns of DNS_SERVERS) {
    const result = await run("dig", [`@${dns.server}`, "+time=3", "+tries=1", "+short", domain, "A"], { timeout: 5000 });
    const records = result.stdout.split(/\s+/).filter(Boolean);

    checks.push({
      details: { records, server: dns.server },
      label: `DNS ${dns.label}`,
      required: true,
      status: records.length > 0 ? "pass" : "fail",
    });
  }

  return checks;
}

async function submitCheckHostHttp(url) {
  const endpoint = new URL("https://check-host.net/check-http");
  endpoint.searchParams.set("host", url);

  for (const node of CHECK_HOST_NODES) {
    endpoint.searchParams.append("node", node);
  }

  return fetchJson(endpoint.toString());
}

async function getCheckHostResults(requestId) {
  let latest = {};

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    latest = await fetchJson(`https://check-host.net/check-result/${requestId}`);

    if (Object.values(latest).every((value) => value !== null)) {
      break;
    }
  }

  return latest;
}

async function checkHttpFromChina(label, url, required = true) {
  try {
    const submitted = await submitCheckHostHttp(url);
    const results = await getCheckHostResults(submitted.request_id);
    const normalized = Object.fromEntries(
      Object.entries(results).map(([node, value]) => [node, normalizeCheckHostNodeResult(value)]),
    );
    const mainland = normalized["cn1.node.check-host.net"];

    return {
      details: {
        nodes: normalized,
        report: submitted.permanent_link,
        url,
      },
      label,
      required,
      status: mainland?.ok ? "pass" : required ? "fail" : "risk",
    };
  } catch (error) {
    return {
      details: { error: error instanceof Error ? error.message : String(error), url },
      label,
      required,
      status: required ? "fail" : "risk",
    };
  }
}

function parseCurlWriteOut(stdout) {
  const statusCode = Number.parseInt(stdout.match(/range_status:(\d+)/)?.[1] ?? "", 10);
  const sizeDownloaded = Number.parseInt(stdout.match(/size:(\d+)/)?.[1] ?? "", 10);
  const contentType = stdout.match(/type:([^\s]+)/)?.[1] ?? null;
  const timeSeconds = Number.parseFloat(stdout.match(/time:([0-9.]+)/)?.[1] ?? "");

  return {
    contentType,
    sizeDownloaded: Number.isNaN(sizeDownloaded) ? null : sizeDownloaded,
    statusCode: Number.isNaN(statusCode) ? null : statusCode,
    timeSeconds: Number.isNaN(timeSeconds) ? null : timeSeconds,
  };
}

export async function probeDownloadUrl(label, url, required = true, runner = run) {
  const result = await runner("curl", [
    "-L",
    "--max-time",
    "25",
    "-r",
    "0-1023",
    "-o",
    "/dev/null",
    "-sS",
    "-w",
    "range_status:%{http_code} size:%{size_download} type:%{content_type} time:%{time_total}",
    url,
  ], { timeout: 30000 });
  const details = {
    ...parseCurlWriteOut(result.stdout),
    probe: "range",
    url,
  };
  const ok = result.ok &&
    (details.statusCode === 200 || details.statusCode === 206) &&
    typeof details.sizeDownloaded === "number" &&
    details.sizeDownloaded > 0;

  return {
    details: result.ok ? details : { ...details, error: result.stderr },
    label,
    required,
    status: ok ? "pass" : required ? "fail" : "risk",
  };
}

function extractExternalUrls(html, baseUrl) {
  const urls = new Set();

  for (const match of html.matchAll(/https?:\/\/[^"'<> )\\]+/g)) {
    const absolute = toAbsoluteUrl(match[0], baseUrl);

    if (absolute) {
      urls.add(absolute);
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/gis)) {
    const absolute = toAbsoluteUrl(match[1], baseUrl);

    if (absolute && new URL(absolute).origin !== new URL(baseUrl).origin) {
      urls.add(absolute);
    }
  }

  return [...urls].sort();
}

function auditExternalUrls(html, baseUrl) {
  const findings = extractExternalUrls(html, baseUrl).map((url) => ({
    ...classifyExternalUrl(url),
    url,
  }));
  const highRisk = findings.filter((finding) => finding.level === "high");

  return {
    details: { findings },
    label: "external dependency risk audit",
    required: true,
    status: highRisk.length > 0 ? "risk" : "pass",
  };
}

function getCheckoutUrlFromEnv() {
  return process.env.CHINA_ACCESS_CHECKOUT_URL || process.env.E2E_DODO_CHECKOUT_URL || "";
}

function getLoginCredentialsFromEnv() {
  const email = process.env.CHINA_ACCESS_EMAIL || process.env.E2E_USER_EMAIL || "";
  const password = process.env.CHINA_ACCESS_PASSWORD || "";

  return email && password ? { email, password } : null;
}

async function checkEmailLogin(baseUrl) {
  const credentials = getLoginCredentialsFromEnv();

  if (!credentials) {
    return {
      details: {
        reason: "Set CHINA_ACCESS_EMAIL and CHINA_ACCESS_PASSWORD to test the production email/password login path.",
      },
      label: "email/password login",
      required: false,
      status: "skipped",
    };
  }

  const result = await run("node", [
    "-e",
    `
      const { chromium } = require('@playwright/test');
      (async () => {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(${JSON.stringify(`${baseUrl}/en/login?next=%2Fen%2Fdashboard`)}, { waitUntil: 'domcontentloaded' });
        await page.locator('#login-email').fill(${JSON.stringify(credentials.email)});
        await page.locator('#login-password').fill(${JSON.stringify(credentials.password)});
        await Promise.all([
          page.waitForURL(/\\/en\\/dashboard/, { timeout: 30000 }),
          page.getByRole('button', { name: 'Sign in with email' }).click(),
        ]);
        await browser.close();
      })().catch((error) => { console.error(error.message); process.exit(1); });
    `,
  ], { timeout: 45000 });

  return {
    details: result.ok ? {} : { error: result.stderr },
    label: "email/password login",
    required: false,
    status: result.ok ? "pass" : "risk",
  };
}

async function runAudit() {
  const baseUrl = (process.env.CHINA_ACCESS_BASE_URL || process.env.E2E_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const domain = new URL(baseUrl).hostname;
  const checks = [];

  checks.push(...await checkDns(domain));

  for (const path of REQUIRED_PATHS) {
    checks.push(await checkHttpFromChina(`mainland HTTP ${path}`, `${baseUrl}${path}`, true));
  }

  const homeHtml = await fetchText(`${baseUrl}/en`);
  const downloadLinks = extractDownloadLinks(homeHtml, baseUrl);

  if (downloadLinks.length === 0) {
    checks.push({
      details: { reason: "No download anchors were found on /en." },
      label: "download link discovery",
      required: true,
      status: "fail",
    });
  } else {
    checks.push({
      details: { downloadLinks },
      label: "download link discovery",
      required: true,
      status: "pass",
    });

    for (const link of downloadLinks) {
      const risk = classifyExternalUrl(link.href);
      checks.push({
        details: { href: link.href, label: link.label, risk },
        label: `download risk ${link.label}`,
        required: true,
        status: risk.level === "high" ? "fail" : risk.level === "medium" ? "risk" : "pass",
      });
      checks.push(await probeDownloadUrl(`mainland download ${link.label}`, link.href, true));
    }
  }

  checks.push(auditExternalUrls(homeHtml, baseUrl));

  const checkoutUrl = getCheckoutUrlFromEnv();

  if (checkoutUrl) {
    checks.push(await checkHttpFromChina("Dodo checkout session", checkoutUrl, true));
  } else {
    checks.push({
      details: {
        reason: "Set CHINA_ACCESS_CHECKOUT_URL to a real Dodo checkout session URL for mainland node verification.",
      },
      label: "Dodo checkout session",
      required: false,
      status: "skipped",
    });
  }

  checks.push(await checkEmailLogin(baseUrl));

  const report = {
    baseUrl,
    checks,
    generatedAt: new Date().toISOString(),
    summary: createSummary(checks),
  };
  const outputPath = process.env.CHINA_ACCESS_REPORT_PATH || "";

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report, null, 2));

  if (report.summary.failedRequired.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAudit().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
