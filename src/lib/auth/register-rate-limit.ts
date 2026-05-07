type RegisterCountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq: (column: string, value: string | null) => RegisterCountQuery;
  gte: (column: string, value: string) => RegisterCountQuery;
  is: (column: string, value: null) => RegisterCountQuery;
};

export type RegisterLimitClient = {
  from: (table: "registration_attempts") => {
    insert: (row: {
      email_domain: string;
      email_normalized: string;
      ip_address: string | null;
      user_agent: string | null;
    }) => PromiseLike<{ error: unknown }>;
    select: (columns: string, options: { count: "exact"; head: true }) => RegisterCountQuery;
  };
};

const WINDOW_SECONDS = 10 * 60;
const WINDOW_MS = WINDOW_SECONDS * 1000;
const MAX_ATTEMPTS = 5;

function getEmailDomain(email: string) {
  return email.toLowerCase().split("@")[1] ?? "unknown";
}

export async function checkRegisterRateLimit(
  client: RegisterLimitClient,
  input: { email: string; ip: string | null; now?: Date; userAgent?: string | null },
) {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const ip = input.ip?.trim() || null;

  let countQuery = client
    .from("registration_attempts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("email_normalized", email);
  countQuery = ip ? countQuery.eq("ip_address", ip) : countQuery.is("ip_address", null);

  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new Error("Unable to check registration rate limit");
  }

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return {
      ok: false as const,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }

  const { error: insertError } = await client.from("registration_attempts").insert({
    email_domain: getEmailDomain(email),
    email_normalized: email,
    ip_address: ip,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
  });

  if (insertError) {
    throw new Error("Unable to record registration attempt");
  }

  return { ok: true as const };
}
