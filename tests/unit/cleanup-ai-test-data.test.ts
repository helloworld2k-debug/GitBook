import { describe, expect, it, vi } from "vitest";

const modulePath = "../../scripts/cleanup-ai-test-data.mjs";

describe("cleanup-ai-test-data script", () => {
  it("classifies obvious codex regression accounts as delete candidates", async () => {
    const { classifyUserCandidate } = await import(modulePath);

    const candidate = classifyUserCandidate({
      admin_role: "user",
      email: "codex-full-1770000000000@example.test",
      id: "user-1",
      is_admin: false,
      last_sign_in_at: null,
      raw_user_meta_data: { source: "codex-online-regression" },
      display_name: "codex-full-1770000000000 user",
    });

    expect(candidate.disposition).toBe("delete");
    expect(candidate.cleanupEffect).toBe("delete_auth_user_cascades_profile_owned_records");
    expect(candidate.reasons).toEqual(
      expect.arrayContaining(["metadata_source", "example_test_email", "codex_full_marker"]),
    );
  });

  it("protects admin accounts even when they match test markers", async () => {
    const { classifyUserCandidate } = await import(modulePath);

    const candidate = classifyUserCandidate({
      admin_role: "owner",
      email: "codex-full-owner@example.test",
      id: "owner-1",
      is_admin: true,
      last_sign_in_at: null,
      raw_user_meta_data: { source: "codex-online-regression" },
      display_name: "codex-full-owner",
    });

    expect(candidate.disposition).toBe("protected");
    expect(candidate.cleanupEffect).toBe("none");
    expect(candidate.protections).toEqual(expect.arrayContaining(["admin_account"]));
  });

  it("keeps risky matches in manual review instead of deletion", async () => {
    const { classifyUserCandidate } = await import(modulePath);

    const candidate = classifyUserCandidate({
      admin_role: "user",
      email: "real-user@example.com",
      id: "user-2",
      is_admin: false,
      last_sign_in_at: "2026-05-24T00:00:00.000Z",
      raw_user_meta_data: { source: "codex-online-regression" },
      display_name: "Regression User",
    });

    expect(candidate.disposition).toBe("needs_review");
    expect(candidate.cleanupEffect).toBe("none");
    expect(candidate.protections).toEqual(expect.arrayContaining(["non_example_test_email", "recent_login", "missing_codex_full_marker"]));
  });

  it("does not run destructive SQL during dry-run", async () => {
    const { runCleanup } = await import(modulePath);
    const query = vi.fn(async () => []);
    const writeReport = vi.fn(async () => "/tmp/report.json");
    const log = vi.fn();

    await runCleanup({
      argv: ["--dry-run"],
      log,
      query,
      writeReport,
    });

    expect(query).toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => /delete\s+from/i.test(String(sql)))).toBe(false);
    expect(writeReport).toHaveBeenCalled();
  });

  it("requires a matching confirmation runId before execute deletes data", async () => {
    const { buildReport, runCleanup } = await import(modulePath);
    const rowsByLabel = new Map<string, unknown[]>([
      [
        "users",
        [
          {
            admin_role: "user",
            email: "codex-full-1770000000000@example.test",
            id: "user-1",
            is_admin: false,
            last_sign_in_at: null,
            raw_user_meta_data: { source: "codex-online-regression" },
            display_name: "codex-full-1770000000000 user",
          },
        ],
      ],
      ["notifications", []],
      ["software_releases", []],
      ["license_code_batches", []],
    ]);
    const query = vi.fn(async (sql: string) => {
      const label = String(sql).match(/cleanup_ai_test_data:([a-z_]+)/)?.[1] ?? "";
      return rowsByLabel.get(label) ?? [];
    });
    const writeReport = vi.fn(async () => "/tmp/report.json");
    const log = vi.fn();
    const report = buildReport({
      licenseCodeBatches: [],
      notifications: [],
      softwareReleases: [],
      users: rowsByLabel.get("users") ?? [],
    });

    await expect(
      runCleanup({
        argv: ["--execute", "--confirm", "wrong-run-id"],
        log,
        query,
        writeReport,
      }),
    ).rejects.toThrow(/Confirmation runId mismatch/);

    expect(query.mock.calls.some(([sql]) => /delete\s+from/i.test(String(sql)))).toBe(false);

    await runCleanup({
      argv: ["--execute", "--confirm", report.runId],
      log,
      query,
      writeReport,
    });

    expect(query.mock.calls.some(([sql]) => /delete\s+from\s+auth\.users/i.test(String(sql)))).toBe(true);
  });
});
