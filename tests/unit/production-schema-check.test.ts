import { describe, expect, it } from "vitest";

import { createSchemaCheckSummary } from "../../scripts/production-schema-check.mjs";

describe("production schema check helpers", () => {
  it("passes when account_type can be selected", () => {
    expect(createSchemaCheckSummary({ accountTypeError: null })).toEqual({
      accountType: {
        code: null,
        message: null,
        status: "pass",
      },
      status: "pass",
    });
  });

  it("fails with a clear migration hint when account_type is missing", () => {
    expect(
      createSchemaCheckSummary({
        accountTypeError: {
          code: "42703",
          message: "column profiles.account_type does not exist",
        },
      }),
    ).toEqual({
      accountType: {
        code: "42703",
        message: "column profiles.account_type does not exist",
        migration: "supabase/migrations/0066_admin_user_account_type.sql",
        status: "fail",
      },
      status: "fail",
    });
  });
});
