/**
 * Verify RPC function signatures match code usage
 * Run: npx tsx scripts/verify-rpc-functions.ts
 */

interface RpcFunctionDefinition {
  name: string;
  file: string;
  params: Record<string, string>; // param name: type
}

interface RpcCall {
  file: string;
  function: string;
  params: string[];
}

// RPC function definitions from migrations
const definedFunctions: RpcFunctionDefinition[] = [
  {
    name: "grant_cloud_sync_entitlement_for_donation",
    file: "supabase/migrations/0048_cloud_sync_monthly_entitlement.sql",
    params: {
      input_user_id: "uuid",
      input_donation_id: "uuid",
      input_months: "integer",
      input_paid_at: "timestamptz",
    },
  },
  {
    name: "allocate_certificate_number",
    file: "supabase/migrations/0002_certificate_functions.sql",
    params: {
      input_type: "certificate_type",
    },
  },
  {
    name: "get_paid_total",
    file: "supabase/migrations/0002_certificate_functions.sql",
    params: {
      input_user_id: "uuid",
    },
  },
];

// RPC calls from code (to be maintained)
const codeCalls: RpcCall[] = [
  {
    file: "src/lib/license/entitlements.ts",
    function: "grant_cloud_sync_entitlement_for_donation",
    params: ["input_months", "input_donation_id", "input_paid_at", "input_user_id"],
  },
  {
    file: "src/lib/certificates/service.ts",
    function: "allocate_certificate_number",
    params: ["input_type"],
  },
  {
    file: "src/lib/certificates/service.ts",
    function: "get_paid_total",
    params: ["input_user_id"],
  },
];

function verifySignatures() {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const call of codeCalls) {
    const definition = definedFunctions.find((f) => f.name === call.function);

    if (!definition) {
      errors.push(`❌ RPC function "${call.function}" called in ${call.file} but not defined in migrations`);
      continue;
    }

    // Check if all params in call are defined
    for (const param of call.params) {
      if (!(param in definition.params)) {
        errors.push(
          `❌ Parameter mismatch: "${call.function}" called with "${param}" in ${call.file} but not defined in ${definition.file}`,
        );
      }
    }

    // Check for extra defined params not used in call (might be optional)
    for (const param of Object.keys(definition.params)) {
      if (!call.params.includes(param)) {
        warnings.push(
          `⚠️  Parameter "${param}" defined in "${call.function}" but not passed in ${call.file} (might be optional)`,
        );
      }
    }
  }

  // Check for unused defined functions
  for (const def of definedFunctions) {
    const isUsed = codeCalls.some((call) => call.function === def.name);
    if (!isUsed) {
      warnings.push(`⚠️  RPC function "${def.name}" defined in ${def.file} but not used in code`);
    }
  }

  return { errors, warnings };
}

function main() {
  console.log("🔍 Verifying RPC function signatures...\n");

  const { errors, warnings } = verifySignatures();

  if (warnings.length > 0) {
    console.log("Warnings:");
    warnings.forEach((w) => console.log(w));
    console.log();
  }

  if (errors.length > 0) {
    console.log("Errors:");
    errors.forEach((e) => console.log(e));
    console.log();
    console.error(`❌ Found ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log("✅ All RPC function signatures match!");
  process.exit(0);
}

main();
