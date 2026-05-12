type LoginAttemptResult = "failure" | "success";

type LoginCountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq: (column: string, value: string | null) => LoginCountQuery;
  gte: (column: string, value: string) => LoginCountQuery;
  is: (column: string, value: null) => LoginCountQuery;
};

export type LoginRiskClient = {
  from: (table: "login_attempts") => {
    insert: (row: {
      email_domain: string;
      email_normalized: string;
      ip_address: string | null;
      result: LoginAttemptResult;
      user_agent: string | null;
    }) => PromiseLike<{ error: unknown }>;
    select: (columns: string, options?: { count: "exact"; head: true }) => LoginCountQuery;
  };
};

const WINDOW_SECONDS = 10 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;
const MAX_EMAIL_IP_FAILURES = 5;
const MAX_IP_FAILURES = 20;
const MAX_EMAIL_FAILURES = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getEmailDomain(email: string) {
  return normalizeEmail(email).split("@")[1] ?? "unknown";
}

async function countFailedLogins(client: LoginRiskClient, columns: string, since: string, filters: Array<[string, string | null]>) {
  let query = client
    .from("login_attempts")
    .select(columns, { count: "exact", head: true })
    .eq("result", "failure")
    .gte("created_at", since);

  for (const [column, value] of filters) {
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error("Unable to check login risk");
  }

  return count ?? 0;
}

export async function checkLoginRisk(
  client: LoginRiskClient,
  input: { email: string; ip: string | null; now?: Date },
) {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  const ip = input.ip?.trim() || null;
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();

  const emailIpFailures = await countFailedLogins(client, "id", since, [
    ["email_normalized", email],
    ["ip_address", ip],
  ]);

  if (emailIpFailures >= MAX_EMAIL_IP_FAILURES) {
    return { captchaRequired: true as const };
  }

  const emailFailures = await countFailedLogins(client, "id,ip_address", since, [["email_normalized", email]]);

  if (emailFailures >= MAX_EMAIL_FAILURES) {
    return { captchaRequired: true as const };
  }

  if (ip) {
    const ipFailures = await countFailedLogins(client, "id,email_normalized", since, [["ip_address", ip]]);

    if (ipFailures >= MAX_IP_FAILURES) {
      return { captchaRequired: true as const };
    }
  }

  return { captchaRequired: false as const };
}

export async function recordLoginAttempt(
  client: LoginRiskClient,
  input: { email: string; ip: string | null; result: LoginAttemptResult; userAgent?: string | null },
) {
  const email = normalizeEmail(input.email);
  const { error } = await client.from("login_attempts").insert({
    email_domain: getEmailDomain(email),
    email_normalized: email,
    ip_address: input.ip?.trim() || null,
    result: input.result,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
  });

  if (error) {
    throw new Error("Unable to record login attempt");
  }
}
