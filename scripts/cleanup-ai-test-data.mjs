#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..");
const TEST_MARKER = "codex-full-";
const RECENT_LOGIN_CUTOFF_DAYS = 14;

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlArray(values) {
  if (values.length === 0) return "array[]::uuid[]";
  return `array[${values.map((value) => `${sqlLiteral(value)}::uuid`).join(", ")}]`;
}

function normalizeJson(value) {
  if (!value || typeof value !== "object") return {};
  return value;
}

function hasCodexFullMarker(...values) {
  return values.some((value) => String(value ?? "").toLowerCase().includes(TEST_MARKER));
}

function isExampleTestEmail(email) {
  return String(email ?? "").toLowerCase().endsWith("@example.test");
}

function isRecentLogin(lastSignInAt, now = new Date()) {
  if (!lastSignInAt) return false;
  const parsed = new Date(lastSignInAt);
  if (Number.isNaN(parsed.getTime())) return true;
  return now.getTime() - parsed.getTime() < RECENT_LOGIN_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
}

export function classifyUserCandidate(row, options = {}) {
  const now = options.now ?? new Date();
  const metadata = normalizeJson(row.raw_user_meta_data);
  const email = String(row.email ?? "");
  const displayName = String(row.display_name ?? "");
  const reasons = [];
  const protections = [];

  if (metadata.source === "codex-online-regression") reasons.push("metadata_source");
  if (isExampleTestEmail(email)) reasons.push("example_test_email");
  if (hasCodexFullMarker(email, displayName)) reasons.push("codex_full_marker");

  if (row.is_admin === true || row.admin_role === "owner" || row.admin_role === "operator") {
    protections.push("admin_account");
  }
  if (!isExampleTestEmail(email)) protections.push("non_example_test_email");
  if (isRecentLogin(row.last_sign_in_at, now)) protections.push("recent_login");
  if (!hasCodexFullMarker(email, displayName)) protections.push("missing_codex_full_marker");

  if (protections.includes("admin_account")) {
    return { ...row, cleanupEffect: "none", disposition: "protected", protections, reasons };
  }

  if (reasons.length === 0) {
    return { ...row, cleanupEffect: "none", disposition: "ignored", protections, reasons };
  }

  if (protections.length > 0) {
    return { ...row, cleanupEffect: "none", disposition: "needs_review", protections, reasons };
  }

  return { ...row, cleanupEffect: "delete_auth_user_cascades_profile_owned_records", disposition: "delete", protections, reasons };
}

function classifyGlobalCandidate(row, markerFields, labelField) {
  const reasons = [];
  if (markerFields.some((field) => hasCodexFullMarker(row[field]))) reasons.push("codex_full_marker");
  if (String(row.version ?? "").toLowerCase().startsWith("codex-")) reasons.push("codex_release_version");

  return {
    ...row,
    cleanupEffect: reasons.length > 0 ? "direct_delete_not_user_cascade" : "none",
    disposition: reasons.length > 0 ? "delete" : "needs_review",
    label: row[labelField] ?? row.id,
    reasons,
  };
}

function summarizeRows(rows, fields) {
  return rows.slice(0, 25).map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null])));
}

function createRunId(payload) {
  const stablePayload = JSON.stringify({
    licenseCodeBatchIds: payload.licenseCodeBatchCandidates.map((row) => row.id).sort(),
    notificationIds: payload.notificationCandidates.map((row) => row.id).sort(),
    softwareReleaseIds: payload.softwareReleaseCandidates.map((row) => row.id).sort(),
    userIds: payload.userCandidates.filter((row) => row.disposition === "delete").map((row) => row.id).sort(),
  });
  return createHash("sha256").update(stablePayload).digest("hex").slice(0, 16);
}

export function buildReport(input, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const userCandidates = (input.users ?? []).map((row) => classifyUserCandidate(row, options));
  const notificationCandidates = (input.notifications ?? []).map((row) => classifyGlobalCandidate(row, ["title", "body"], "title"));
  const softwareReleaseCandidates = (input.softwareReleases ?? []).map((row) => classifyGlobalCandidate(row, ["version", "notes"], "version"));
  const licenseCodeBatchCandidates = (input.licenseCodeBatches ?? []).map((row) => classifyGlobalCandidate(row, ["label", "channel_note"], "label"));
  const payload = {
    generatedAt,
    licenseCodeBatchCandidates,
    notificationCandidates,
    softwareReleaseCandidates,
    userCandidates,
  };
  const runId = createRunId(payload);

  return {
    ...payload,
    runId,
    summary: {
      global: {
        licenseCodeBatchesToDelete: licenseCodeBatchCandidates.filter((row) => row.disposition === "delete").length,
        notificationsToDelete: notificationCandidates.filter((row) => row.disposition === "delete").length,
        softwareReleasesToDelete: softwareReleaseCandidates.filter((row) => row.disposition === "delete").length,
      },
      users: {
        protected: userCandidates.filter((row) => row.disposition === "protected").length,
        toDelete: userCandidates.filter((row) => row.disposition === "delete").length,
        needsReview: userCandidates.filter((row) => row.disposition === "needs_review").length,
      },
    },
  };
}

function parseArgs(argv) {
  const args = {
    confirm: null,
    dryRun: true,
    execute: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") {
      args.execute = true;
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.execute = false;
    } else if (arg === "--confirm") {
      args.confirm = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function helpText() {
  return `Usage:
  node scripts/cleanup-ai-test-data.mjs --dry-run
  node scripts/cleanup-ai-test-data.mjs --execute --confirm <runId>

The script is dry-run by default. Execute mode permanently deletes only safe test candidates.`;
}

function defaultQuery(sql) {
  let output;

  try {
    output = execFileSync("supabase", ["db", "query", sql, "--linked", "--output", "json"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString("utf8").trim() : "";
    const message = stderr || (error instanceof Error ? error.message : String(error));
    throw new Error(`Supabase linked query failed. Run this from a linked Supabase workspace or run "supabase link" first. ${message}`);
  }

  const jsonStart = output.indexOf("{");
  const parsed = JSON.parse(jsonStart >= 0 ? output.slice(jsonStart) : output);
  return parsed.rows ?? [];
}

async function defaultWriteReport(report) {
  const reportsDir = join(repoRoot, ".gstack", "cleanup-reports");
  await mkdir(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `${report.generatedAt.replaceAll(/[:.]/g, "-")}-${report.runId}.json`);
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return filePath;
}

const SELECT_QUERIES = {
  users: `
    /* cleanup_ai_test_data:users */
    select
      auth_users.id,
      auth_users.email,
      auth_users.raw_user_meta_data,
      auth_users.last_sign_in_at,
      profiles.display_name,
      profiles.admin_role,
      profiles.is_admin,
      coalesce(donation_counts.count, 0)::int as donations_count,
      coalesce(certificate_counts.count, 0)::int as certificates_count,
      coalesce(entitlement_counts.count, 0)::int as license_entitlements_count,
      coalesce(redemption_counts.count, 0)::int as trial_code_redemptions_count,
      coalesce(desktop_session_counts.count, 0)::int as desktop_sessions_count,
      coalesce(cloud_sync_lease_counts.count, 0)::int as cloud_sync_leases_count,
      coalesce(cloud_sync_usage_counts.count, 0)::int as cloud_sync_usage_events_count,
      coalesce(feedback_counts.count, 0)::int as support_feedback_count,
      coalesce(notification_read_counts.count, 0)::int as notification_reads_count,
      coalesce(login_history_counts.count, 0)::int as user_login_history_count
    from auth.users auth_users
    left join public.profiles profiles on profiles.id = auth_users.id
    left join lateral (select count(*) from public.donations where user_id = auth_users.id) donation_counts on true
    left join lateral (select count(*) from public.certificates where user_id = auth_users.id) certificate_counts on true
    left join lateral (select count(*) from public.license_entitlements where user_id = auth_users.id) entitlement_counts on true
    left join lateral (select count(*) from public.trial_code_redemptions where user_id = auth_users.id) redemption_counts on true
    left join lateral (select count(*) from public.desktop_sessions where user_id = auth_users.id) desktop_session_counts on true
    left join lateral (select count(*) from public.cloud_sync_leases where user_id = auth_users.id) cloud_sync_lease_counts on true
    left join lateral (select count(*) from public.cloud_sync_usage_events where user_id = auth_users.id) cloud_sync_usage_counts on true
    left join lateral (select count(*) from public.support_feedback where user_id = auth_users.id) feedback_counts on true
    left join lateral (select count(*) from public.notification_reads where user_id = auth_users.id) notification_read_counts on true
    left join lateral (select count(*) from public.user_login_history where user_id = auth_users.id) login_history_counts on true
    where auth_users.raw_user_meta_data->>'source' = 'codex-online-regression'
      or auth_users.email ilike 'codex-full-%@example.test'
      or profiles.display_name ilike '%codex-full-%'
      or profiles.public_display_name ilike '%codex-full-%'
    order by auth_users.created_at desc
    limit 500;
  `,
  notifications: `
    /* cleanup_ai_test_data:notifications */
    select id, title, body, published_at, created_at
    from public.notifications
    where title ilike 'codex-full-%'
      or body ilike 'codex-full-%'
    order by created_at desc
    limit 500;
  `,
  software_releases: `
    /* cleanup_ai_test_data:software_releases */
    select id, version, notes, is_published, released_at, created_at
    from public.software_releases
    where version ilike 'codex-%'
      or notes ilike 'codex-full-%'
    order by created_at desc
    limit 500;
  `,
  license_code_batches: `
    /* cleanup_ai_test_data:license_code_batches */
    select
      batches.id,
      batches.label,
      batches.channel_type,
      batches.channel_note,
      batches.created_at,
      coalesce(code_counts.count, 0)::int as trial_codes_count
    from public.license_code_batches batches
    left join lateral (select count(*) from public.trial_codes where batch_id = batches.id) code_counts on true
    where batches.label ilike 'codex-full-%'
      or batches.channel_note ilike 'codex-full-%'
    order by batches.created_at desc
    limit 500;
  `,
};

async function collectCandidates(query) {
  const [users, notifications, softwareReleases, licenseCodeBatches] = await Promise.all([
    query(SELECT_QUERIES.users),
    query(SELECT_QUERIES.notifications),
    query(SELECT_QUERIES.software_releases),
    query(SELECT_QUERIES.license_code_batches),
  ]);

  return {
    licenseCodeBatches,
    notifications,
    softwareReleases,
    users,
  };
}

function printSummary(report, { execute, log = console.log }) {
  log(`runId: ${report.runId}`);
  log(`mode: ${execute ? "execute" : "dry-run"}`);
  log(`users: ${report.summary.users.toDelete} delete, ${report.summary.users.needsReview} needs review, ${report.summary.users.protected} protected`);
  log(`global: ${report.summary.global.notificationsToDelete} notifications, ${report.summary.global.softwareReleasesToDelete} releases, ${report.summary.global.licenseCodeBatchesToDelete} license batches`);
  log("user delete candidates:");
  log(JSON.stringify(summarizeRows(report.userCandidates.filter((row) => row.disposition === "delete"), ["id", "email", "cleanupEffect", "donations_count", "certificates_count", "trial_code_redemptions_count"]), null, 2));
  log("needs review:");
  log(JSON.stringify(summarizeRows(report.userCandidates.filter((row) => row.disposition === "needs_review"), ["id", "email", "protections", "reasons"]), null, 2));
}

async function executeCleanup(report, query) {
  const userIds = report.userCandidates.filter((row) => row.disposition === "delete").map((row) => row.id);
  const notificationIds = report.notificationCandidates.filter((row) => row.disposition === "delete").map((row) => row.id);
  const releaseIds = report.softwareReleaseCandidates.filter((row) => row.disposition === "delete").map((row) => row.id);
  const batchIds = report.licenseCodeBatchCandidates.filter((row) => row.disposition === "delete").map((row) => row.id);

  if (notificationIds.length > 0) {
    await query(`delete from public.notifications where id = any(${sqlArray(notificationIds)});`);
  }
  if (releaseIds.length > 0) {
    await query(`delete from public.software_releases where id = any(${sqlArray(releaseIds)});`);
  }
  if (batchIds.length > 0) {
    await query(`delete from public.trial_codes where batch_id = any(${sqlArray(batchIds)}); delete from public.license_code_batches where id = any(${sqlArray(batchIds)});`);
  }
  if (userIds.length > 0) {
    await query(`delete from auth.users where id = any(${sqlArray(userIds)});`);
  }
}

export async function runCleanup({
  argv = process.argv.slice(2),
  log = console.log,
  query = defaultQuery,
  writeReport = defaultWriteReport,
} = {}) {
  const args = parseArgs(argv);

  if (args.help) {
    log(helpText());
    return null;
  }

  const candidates = await collectCandidates(query);
  const report = buildReport(candidates);
  const reportPath = await writeReport(report);
  printSummary(report, { execute: args.execute, log });
  log(`report: ${reportPath}`);

  if (!args.execute) {
    log(`dry-run only. To permanently delete safe candidates, rerun with: node scripts/cleanup-ai-test-data.mjs --execute --confirm ${report.runId}`);
    return report;
  }

  if (args.confirm !== report.runId) {
    throw new Error(`Confirmation runId mismatch. Expected --confirm ${report.runId}`);
  }

  await executeCleanup(report, query);
  log("cleanup complete");
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanup().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
