import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const defaultExpected = {
  gitOriginSubstring: "helloworld2k-debug/GitBook.git",
  supabaseProjectRef: "dzsnhbszojdaghvolcnq",
  vercelProjectName: "gitbook-website",
};

function readText(path) {
  if (!existsSync(path)) {
    return null;
  }

  return readFileSync(path, "utf8");
}

function readJson(path) {
  const text = readText(path);

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseTomlScalars(text) {
  const values = {};
  let section = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();

    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[(?<section>[^\]]+)\]$/);

    if (sectionMatch?.groups?.section) {
      section = sectionMatch.groups.section.trim();
      continue;
    }

    const scalarMatch = line.match(/^(?<key>[A-Za-z0-9_.-]+)\s*=\s*(?<value>.+)$/);

    if (!scalarMatch?.groups) {
      continue;
    }

    const key = section ? `${section}.${scalarMatch.groups.key}` : scalarMatch.groups.key;
    const rawValue = scalarMatch.groups.value.trim();
    const quoted = rawValue.match(/^"(?<value>.*)"$/);
    const numeric = rawValue.match(/^\d+$/);

    values[key] = quoted?.groups?.value ?? (numeric ? Number(rawValue) : rawValue);
  }

  return values;
}

export function readSupabaseConfigSummary(projectRoot) {
  const configPath = join(projectRoot, "supabase", "config.toml");
  const text = readText(configPath);

  if (!text) {
    return null;
  }

  const values = parseTomlScalars(text);
  const ports = {};

  for (const key of ["api.port", "db.port", "db.shadow_port", "db.pooler.port", "studio.port", "inbucket.port"]) {
    if (typeof values[key] === "number") {
      ports[key] = values[key];
    }
  }

  return {
    path: configPath,
    ports,
    projectId: typeof values.project_id === "string" ? values.project_id : null,
  };
}

function getGitOrigin(projectRoot) {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function getGitIgnoredFiles(projectRoot) {
  const result = spawnSync("git", ["check-ignore", ".env.local", ".vercel/project.json", "supabase/.temp/project-ref"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  return new Set(result.stdout.split(/\r?\n/).filter(Boolean));
}

function check(status, id, message, details = {}) {
  return { details, id, message, status };
}

function findSiblingProjects(workspaceRoot, currentRoot) {
  if (!workspaceRoot || !existsSync(workspaceRoot)) {
    return [];
  }

  const projects = [];
  const currentResolved = resolve(currentRoot);

  for (const entry of readdirSync(workspaceRoot)) {
    const candidate = join(workspaceRoot, entry);

    if (resolve(candidate) === currentResolved) {
      continue;
    }

    try {
      if (!statSync(candidate).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    if (existsSync(join(candidate, "package.json")) || existsSync(join(candidate, "supabase", "config.toml"))) {
      projects.push(candidate);
    }
  }

  return projects;
}

function collectSiblingSupabasePortConflictChecks(projectRoot, workspaceRoot) {
  const current = readSupabaseConfigSummary(projectRoot);

  if (!current) {
    return [
      check("skip", "supabase-sibling-port-conflicts", "No local Supabase config found in current project."),
    ];
  }

  const currentPorts = new Map(Object.entries(current.ports).map(([key, port]) => [port, key]));
  const conflicts = [];

  for (const siblingRoot of findSiblingProjects(workspaceRoot, projectRoot)) {
    const sibling = readSupabaseConfigSummary(siblingRoot);

    if (!sibling) {
      continue;
    }

    for (const [siblingKey, siblingPort] of Object.entries(sibling.ports)) {
      const currentKey = currentPorts.get(siblingPort);

      if (currentKey) {
        conflicts.push({
          currentKey,
          port: siblingPort,
          siblingKey,
          siblingProject: sibling.projectId,
          siblingRoot: relative(workspaceRoot, siblingRoot),
        });
      }
    }
  }

  if (conflicts.length > 0) {
    return [
      check("fail", "supabase-sibling-port-conflicts", "Sibling projects reuse local Supabase ports.", { conflicts }),
    ];
  }

  return [
    check("pass", "supabase-sibling-port-conflicts", "No sibling Supabase port conflicts found."),
  ];
}

export function collectProjectIsolationChecks(projectRoot = process.cwd(), options = {}) {
  const expected = { ...defaultExpected, ...(options.expected ?? {}) };
  const checks = [];
  const ignoredFiles = getGitIgnoredFiles(projectRoot);
  const gitOrigin = getGitOrigin(projectRoot);

  if (expected.gitOriginSubstring) {
    checks.push(
      gitOrigin?.includes(expected.gitOriginSubstring)
        ? check("pass", "git-origin", "Git origin points to the expected repository.", { origin: gitOrigin })
        : check("fail", "git-origin", "Git origin does not match the expected repository.", { expected: expected.gitOriginSubstring, origin: gitOrigin }),
    );
  }

  const vercelProject = readJson(join(projectRoot, ".vercel", "project.json"));

  if (expected.vercelProjectName) {
    checks.push(
      vercelProject?.projectName === expected.vercelProjectName
        ? check("pass", "vercel-project", "Vercel project binding matches this repository.", { projectName: vercelProject.projectName })
        : check("fail", "vercel-project", "Vercel project binding is missing or points elsewhere.", { expected: expected.vercelProjectName, projectName: vercelProject?.projectName ?? null }),
    );
  }

  const supabaseProjectRef = readText(join(projectRoot, "supabase", ".temp", "project-ref"))?.trim() ?? null;

  if (expected.supabaseProjectRef) {
    checks.push(
      supabaseProjectRef === expected.supabaseProjectRef
        ? check("pass", "supabase-project-ref", "Supabase CLI link matches this repository.", { projectRef: supabaseProjectRef })
        : check("fail", "supabase-project-ref", "Supabase CLI link is missing or points elsewhere.", { expected: expected.supabaseProjectRef, projectRef: supabaseProjectRef }),
    );
  }

  checks.push(
    ignoredFiles.has(".env.local")
      ? check("pass", "env-local-ignored", ".env.local is ignored by git.")
      : check("fail", "env-local-ignored", ".env.local is not ignored by git."),
  );
  checks.push(
    ignoredFiles.has(".vercel/project.json")
      ? check("pass", "vercel-local-state-ignored", ".vercel local state is ignored by git.")
      : check("fail", "vercel-local-state-ignored", ".vercel local state is not ignored by git."),
  );
  checks.push(
    ignoredFiles.has("supabase/.temp/project-ref")
      ? check("pass", "supabase-local-state-ignored", "Supabase local link state is ignored by git.")
      : check("fail", "supabase-local-state-ignored", "Supabase local link state is not ignored by git."),
  );

  const supabaseConfig = readSupabaseConfigSummary(projectRoot);

  if (supabaseConfig) {
    checks.push(
      check("pass", "supabase-local-config", "Local Supabase project id and ports were read.", {
        ports: supabaseConfig.ports,
        projectId: supabaseConfig.projectId,
      }),
    );
  } else {
    checks.push(check("skip", "supabase-local-config", "No local Supabase config found."));
  }

  if (options.scanSiblings !== false) {
    checks.push(...collectSiblingSupabasePortConflictChecks(projectRoot, options.workspaceRoot ?? dirname(projectRoot)));
  }

  return checks;
}

function printChecks(checks) {
  for (const item of checks) {
    const prefix = item.status === "pass" ? "PASS" : item.status === "skip" ? "SKIP" : "FAIL";
    console.log(`${prefix} ${item.id}: ${item.message}`);

    if (item.status !== "pass" && Object.keys(item.details).length > 0) {
      console.log(JSON.stringify(item.details, null, 2));
    }
  }
}

function main() {
  const projectRoot = process.cwd();
  const checks = collectProjectIsolationChecks(projectRoot);
  const failures = checks.filter((item) => item.status === "fail");

  printChecks(checks);

  if (failures.length > 0) {
    console.error(`Project isolation check failed with ${failures.length} issue(s).`);
    process.exit(1);
  }
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  main();
}
