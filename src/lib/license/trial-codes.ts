import type { Database } from "@/lib/database.types";
import { hashDesktopSecret } from "@/lib/license/hash";

export type TrialRedeemFailure =
  | "trial_code_invalid"
  | "trial_code_inactive"
  | "trial_code_limit_reached"
  | "machine_trial_used"
  | "duplicate_trial_code_user";

type RedeemClient = {
  rpc: (
    functionName: "redeem_trial_code",
    args: Database["public"]["Functions"]["redeem_trial_code"]["Args"],
  ) => PromiseLike<{
    data: Database["public"]["Functions"]["redeem_trial_code"]["Returns"] | null;
    error: unknown;
  }>;
};

type RedeemTrialCodeInput = {
  userId: string;
  code: string;
  machineCodeHash: string;
  now?: Date;
};

function isTrialRedeemFailure(reason: string): reason is TrialRedeemFailure {
  return (
    reason === "trial_code_invalid" ||
    reason === "trial_code_inactive" ||
    reason === "trial_code_limit_reached" ||
    reason === "machine_trial_used" ||
    reason === "duplicate_trial_code_user"
  );
}

export async function redeemTrialCode(
  client: RedeemClient,
  input: RedeemTrialCodeInput,
): Promise<{ ok: true; validUntil: string } | { ok: false; reason: TrialRedeemFailure }> {
  const now = input.now ?? new Date();
  const codeHash = await hashDesktopSecret(input.code, "trial_code");
  const { data, error } = await client.rpc("redeem_trial_code", {
    input_code_hash: codeHash,
    input_machine_code_hash: input.machineCodeHash,
    input_now: now.toISOString(),
    input_user_id: input.userId,
  });

  if (error) {
    throw new Error("Unable to redeem trial code");
  }

  const row = data?.[0];

  if (!row) {
    throw new Error("Trial code redemption response was malformed");
  }

  if (row.ok) {
    if (!row.valid_until) {
      throw new Error("Trial code redemption response was malformed");
    }

    return { ok: true, validUntil: row.valid_until };
  }

  if (isTrialRedeemFailure(row.reason)) {
    return { ok: false, reason: row.reason };
  }

  throw new Error("Trial code redemption response was malformed");
}
