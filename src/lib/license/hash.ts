import { createHash } from "node:crypto";

const HASH_SALT = process.env.LICENSE_HASH_SALT || "gitbook-ai-development-license-salt";

export function normalizeMachineCode(value: string) {
  return value.trim().toLowerCase();
}

export async function hashDesktopSecret(
  value: string,
  purpose: "auth_code" | "desktop_token" | "machine" | "trial_code",
) {
  const normalized = purpose === "machine" ? normalizeMachineCode(value) : value.trim();

  return createHash("sha256").update(`${purpose}:${HASH_SALT}:${normalized}`).digest("hex");
}
