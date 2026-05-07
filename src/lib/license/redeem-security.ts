type RedeemCountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq: (column: string, value: string) => RedeemCountQuery;
  gte: (column: string, value: string) => RedeemCountQuery;
};

type RedeemBlockQuery = PromiseLike<{ data: { blocked_until: string; reason: string } | null; error: unknown }> & {
  eq: (column: string, value: string) => RedeemBlockQuery;
  gt: (column: string, value: string) => RedeemBlockQuery;
  limit: (count: number) => RedeemBlockQuery;
  maybeSingle: () => PromiseLike<{ data: { blocked_until: string; reason: string } | null; error: unknown }>;
  order: (column: string, options: { ascending: boolean }) => RedeemBlockQuery;
};

export type RedeemSecurityClient = {
  from: (table: "license_code_redeem_attempts" | "license_code_redeem_blocks") => unknown;
};

type RedeemRiskInput = {
  ipAddress: string | null;
  now?: Date;
  userId: string;
};

type RedeemAttemptInput = {
  codeHash: string | null;
  ipAddress: string | null;
  reason: string;
  result: "success" | "failure" | "blocked";
  userAgent?: string | null;
  userId: string;
};

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_SECONDS = 30 * 60;
const USER_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 20;

async function countRecentFailures(client: RedeemSecurityClient, column: "ip_address" | "user_id", value: string, since: string) {
  const query = client.from("license_code_redeem_attempts") as {
    select: (columns: string, options: { count: "exact"; head: true }) => RedeemCountQuery;
  };
  const result = await query
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .eq("result", "failure")
    .gte("created_at", since) as { count: number | null; error: unknown };

  if (result.error) {
    throw new Error("Unable to check license redeem rate limit");
  }

  return result.count ?? 0;
}

async function findActiveBlock(client: RedeemSecurityClient, scope: "ip" | "user", scopeValue: string, nowIso: string) {
  const query = client.from("license_code_redeem_blocks") as {
    select: (columns: string) => RedeemBlockQuery;
  };
  const result = await query
    .select("blocked_until,reason")
    .eq("scope", scope)
    .eq("scope_value", scopeValue)
    .gt("blocked_until", nowIso)
    .order("blocked_until", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { blocked_until: string; reason: string } | null; error: unknown };

  if (result.error) {
    throw new Error("Unable to check license redeem block");
  }

  return result.data;
}

export async function checkLicenseRedeemRisk(client: RedeemSecurityClient, input: RedeemRiskInput) {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const userBlock = await findActiveBlock(client, "user", input.userId, nowIso);

  if (userBlock) {
    return { ok: false as const, reason: "user_blocked" as const, retryAfterSeconds: retryAfterSeconds(userBlock.blocked_until, now) };
  }

  if (input.ipAddress) {
    const ipBlock = await findActiveBlock(client, "ip", input.ipAddress, nowIso);

    if (ipBlock) {
      return { ok: false as const, reason: "ip_blocked" as const, retryAfterSeconds: retryAfterSeconds(ipBlock.blocked_until, now) };
    }
  }

  const userFailures = await countRecentFailures(client, "user_id", input.userId, since);

  if (userFailures >= USER_FAILURE_LIMIT) {
    return { ok: false as const, reason: "user_rate_limited" as const, retryAfterSeconds: BLOCK_SECONDS };
  }

  if (input.ipAddress) {
    const ipFailures = await countRecentFailures(client, "ip_address", input.ipAddress, since);

    if (ipFailures >= IP_FAILURE_LIMIT) {
      return { ok: false as const, reason: "ip_rate_limited" as const, retryAfterSeconds: BLOCK_SECONDS };
    }
  }

  return { ok: true as const };
}

export async function recordLicenseRedeemAttempt(client: RedeemSecurityClient, input: RedeemAttemptInput) {
  const table = client.from("license_code_redeem_attempts") as {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  };
  const { error } = await table.insert({
    code_hash: input.codeHash,
    ip_address: input.ipAddress,
    reason: input.reason,
    result: input.result,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
    user_id: input.userId,
  });

  if (error) {
    throw new Error("Unable to record license redeem attempt");
  }
}

function retryAfterSeconds(value: string, now: Date) {
  return Math.max(1, Math.ceil((new Date(value).getTime() - now.getTime()) / 1000));
}
