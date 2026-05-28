import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  collectProjectIsolationChecks,
  readSupabaseConfigSummary,
} from "../../scripts/check-project-isolation.mjs";

function makeTempProject() {
  return mkdtempSync(join(tmpdir(), "project-isolation-"));
}

describe("project isolation checks", () => {
  it("verifies this repository is linked to the expected Vercel, GitHub, and Supabase projects", () => {
    const checks = collectProjectIsolationChecks(process.cwd(), { scanSiblings: false });

    expect(checks.find((check) => check.id === "git-origin")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "vercel-project")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "supabase-project-ref")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "env-local-ignored")?.status).toBe("pass");
  });

  it("reads local Supabase project id and port assignments from config.toml", () => {
    const root = makeTempProject();

    try {
      mkdirSync(join(root, "supabase"), { recursive: true });
      writeFileSync(
        join(root, "supabase", "config.toml"),
        [
          'project_id = "demo-project"',
          "[api]",
          "port = 54321",
          "[db]",
          "port = 54322",
          "shadow_port = 54320",
          "[studio]",
          "port = 54323",
          "[inbucket]",
          "port = 54324",
        ].join("\n"),
      );

      expect(readSupabaseConfigSummary(root)).toEqual({
        path: join(root, "supabase", "config.toml"),
        ports: {
          "api.port": 54321,
          "db.port": 54322,
          "db.shadow_port": 54320,
          "inbucket.port": 54324,
          "studio.port": 54323,
        },
        projectId: "demo-project",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("flags sibling Supabase projects that reuse this project's local ports", () => {
    const workspace = makeTempProject();
    const current = join(workspace, "current");
    const sibling = join(workspace, "new-project");

    try {
      mkdirSync(join(current, "supabase"), { recursive: true });
      mkdirSync(join(sibling, "supabase"), { recursive: true });
      writeFileSync(join(current, "supabase", "config.toml"), 'project_id = "current"\n[api]\nport = 54321\n');
      writeFileSync(join(sibling, "supabase", "config.toml"), 'project_id = "new-project"\n[api]\nport = 54321\n');

      const checks = collectProjectIsolationChecks(current, {
        expected: {
          gitOriginSubstring: null,
          supabaseProjectRef: null,
          vercelProjectName: null,
        },
        scanSiblings: true,
        workspaceRoot: workspace,
      });

      expect(checks.find((check) => check.id === "supabase-sibling-port-conflicts")).toMatchObject({
        status: "fail",
      });
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });
});
