import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const accountTypeMigration = "supabase/migrations/0066_admin_user_account_type.sql";

export function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const env = {};

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1);

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function readRequiredEnv(env, key) {
  if (!env[key]) {
    throw new Error(`Missing ${key}`);
  }

  return env[key];
}

export function createSchemaCheckSummary({ accountTypeError }) {
  if (!accountTypeError) {
    return {
      accountType: {
        code: null,
        message: null,
        status: "pass",
      },
      status: "pass",
    };
  }

  const isMissingColumn = accountTypeError.code === "42703" || accountTypeError.message?.includes("account_type");

  return {
    accountType: {
      code: accountTypeError.code ?? null,
      message: accountTypeError.message ?? "Unknown schema check error",
      ...(isMissingColumn ? { migration: accountTypeMigration } : {}),
      status: "fail",
    },
    status: "fail",
  };
}

export async function runAccountTypeCheck(supabase) {
  const { error } = await supabase.from("profiles").select("account_type").limit(1);

  return createSchemaCheckSummary({ accountTypeError: error });
}

async function main() {
  const env = { ...process.env, ...loadEnvFile(".env.local") };
  const supabase = createClient(
    readRequiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
    readRequiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const summary = await runAccountTypeCheck(supabase);

  console.log(JSON.stringify(summary, null, 2));

  if (summary.status !== "pass") {
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
