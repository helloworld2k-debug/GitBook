type RegisterCountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq: (column: string, value: string | null) => RegisterCountQuery;
  gt: (column: string, value: string) => RegisterCountQuery;
  gte: (column: string, value: string) => RegisterCountQuery;
  is: (column: string, value: null) => RegisterCountQuery;
  maybeSingle: () => PromiseLike<{ data: { blocked_until: string; reason: string } | null; error: unknown }>;
  order: (column: string, options?: { ascending?: boolean }) => RegisterCountQuery;
};

export type RegisterLimitClient = {
  from: (table: "registration_attempts" | "registration_blocks") => {
    insert: (row: {
      email_domain: string;
      email_normalized: string;
      ip_address: string | null;
      user_agent: string | null;
    }) => PromiseLike<{ error: unknown }>;
    select: (columns: string, options?: { count: "exact"; head: true }) => RegisterCountQuery;
  };
};

const WINDOW_SECONDS = 10 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;
const MAX_EMAIL_IP_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 20;
const MAX_DOMAIN_ATTEMPTS = 50;

function getEmailDomain(email: string) {
  return email.toLowerCase().split("@")[1] ?? "unknown";
}

function retryAfterSeconds(blockedUntil: string, now: Date) {
  return Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - now.getTime()) / 1000));
}

async function getActiveBlock(
  client: RegisterLimitClient,
  scope: "domain" | "email" | "ip",
  scopeValue: string,
  now: Date,
) {
  const { data, error } = await client
    .from("registration_blocks")
    .select("blocked_until,reason")
    .eq("scope", scope)
    .eq("scope_value", scopeValue)
    .is("revoked_at", null)
    .gt("blocked_until", now.toISOString())
    .order("blocked_until", { ascending: false })
    .maybeSingle();

  if (error) {
    throw new Error("Unable to check registration block");
  }

  return data;
}

async function countRecent(client: RegisterLimitClient, columns: string, since: string, filters: Array<[string, string | null]>) {
  let countQuery = client
    .from("registration_attempts")
    .select(columns, { count: "exact", head: true })
    .gte("created_at", since);

  for (const [column, value] of filters) {
    countQuery = value === null ? countQuery.is(column, null) : countQuery.eq(column, value);
  }

  const { count, error } = await countQuery;

  if (error) {
    throw new Error("Unable to check registration rate limit");
  }

  return count ?? 0;
}

export async function checkRegisterRateLimit(
  client: RegisterLimitClient,
  input: { email: string; ip: string | null; now?: Date; userAgent?: string | null },
) {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const domain = getEmailDomain(email);
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const ip = input.ip?.trim() || null;

  const blockCandidates: Array<["domain" | "email" | "ip", string | null]> = [
    ["email", email],
    ["domain", domain],
    ["ip", ip],
  ];

  for (const [scope, scopeValue] of blockCandidates) {
    if (!scopeValue) continue;
    const block = await getActiveBlock(client, scope, scopeValue, now);

    if (block) {
      return {
        ok: false as const,
        retryAfterSeconds: retryAfterSeconds(block.blocked_until, now),
      };
    }
  }

  const emailIpAttempts = await countRecent(client, "id", since, [
    ["email_normalized", email],
    ["ip_address", ip],
  ]);

  if (emailIpAttempts >= MAX_EMAIL_IP_ATTEMPTS) {
    return {
      ok: false as const,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }

  if (ip) {
    const ipAttempts = await countRecent(client, "id,email_normalized", since, [["ip_address", ip]]);

    if (ipAttempts >= MAX_IP_ATTEMPTS) {
      return {
        ok: false as const,
        retryAfterSeconds: WINDOW_SECONDS,
      };
    }
  }

  const domainAttempts = await countRecent(client, "id,ip_address", since, [["email_domain", domain]]);

  if (domainAttempts >= MAX_DOMAIN_ATTEMPTS) {
    return {
      ok: false as const,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }

  const { error: insertError } = await client.from("registration_attempts").insert({
    email_domain: domain,
    email_normalized: email,
    ip_address: ip,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
  });

  if (insertError) {
    throw new Error("Unable to record registration attempt");
  }

  return { ok: true as const };
}
