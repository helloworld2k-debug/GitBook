type ResendCountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq: (column: string, value: string | null) => ResendCountQuery;
  gte: (column: string, value: string) => ResendCountQuery;
  is: (column: string, value: null) => ResendCountQuery;
};

export type ConfirmationResendLimitClient = {
  from: (table: "confirmation_resend_attempts") => {
    insert: (row: {
      email_domain: string;
      email_normalized: string;
      ip_address: string | null;
      user_agent: string | null;
    }) => PromiseLike<{ error: unknown }>;
    select: (columns: string, options?: { count: "exact"; head: true }) => ResendCountQuery;
  };
};

const EMAIL_COOLDOWN_SECONDS = 60;
const EMAIL_DAILY_WINDOW_SECONDS = 24 * 60 * 60;
const IP_HOURLY_WINDOW_SECONDS = 60 * 60;
const MAX_EMAIL_DAILY_RESENDS = 5;
const MAX_IP_HOURLY_RESENDS = 10;

function getEmailDomain(email: string) {
  return email.toLowerCase().split("@")[1] ?? "unknown";
}

async function countRecent(
  client: ConfirmationResendLimitClient,
  columns: string,
  since: string,
  filters: Array<[string, string | null]>,
) {
  let countQuery = client
    .from("confirmation_resend_attempts")
    .select(columns, { count: "exact", head: true })
    .gte("created_at", since);

  for (const [column, value] of filters) {
    countQuery = value === null ? countQuery.is(column, null) : countQuery.eq(column, value);
  }

  const { count, error } = await countQuery;

  if (error) {
    throw new Error("Unable to check confirmation resend rate limit");
  }

  return count ?? 0;
}

export async function checkConfirmationResendRateLimit(
  client: ConfirmationResendLimitClient,
  input: { email: string; ip: string | null; now?: Date; userAgent?: string | null },
) {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const domain = getEmailDomain(email);
  const ip = input.ip?.trim() || null;

  const emailMinuteAttempts = await countRecent(
    client,
    "id,email_minute",
    new Date(now.getTime() - EMAIL_COOLDOWN_SECONDS * 1000).toISOString(),
    [["email_normalized", email]],
  );

  if (emailMinuteAttempts >= 1) {
    return { ok: false as const, retryAfterSeconds: EMAIL_COOLDOWN_SECONDS };
  }

  const emailDayAttempts = await countRecent(
    client,
    "id,email_day",
    new Date(now.getTime() - EMAIL_DAILY_WINDOW_SECONDS * 1000).toISOString(),
    [["email_normalized", email]],
  );

  if (emailDayAttempts >= MAX_EMAIL_DAILY_RESENDS) {
    return { ok: false as const, retryAfterSeconds: IP_HOURLY_WINDOW_SECONDS };
  }

  const ipHourAttempts = await countRecent(
    client,
    "id,ip_hour",
    new Date(now.getTime() - IP_HOURLY_WINDOW_SECONDS * 1000).toISOString(),
    [["ip_address", ip]],
  );

  if (ipHourAttempts >= MAX_IP_HOURLY_RESENDS) {
    return { ok: false as const, retryAfterSeconds: IP_HOURLY_WINDOW_SECONDS };
  }

  const { error: insertError } = await client.from("confirmation_resend_attempts").insert({
    email_domain: domain,
    email_normalized: email,
    ip_address: ip,
    user_agent: input.userAgent?.slice(0, 500) ?? null,
  });

  if (insertError) {
    throw new Error("Unable to record confirmation resend attempt");
  }

  return { ok: true as const };
}
