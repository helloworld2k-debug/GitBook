import { createHash } from "node:crypto";

const DEVELOPMENT_HASH_SALT = "gitbook-ai-development-license-salt";

export type DesktopSecretPurpose = "auth_code" | "desktop_token" | "machine" | "trial_code";

export function normalizeMachineCode(value: string) {
  return value.trim().toLowerCase();
}

function getHashSalt() {
  if (process.env.LICENSE_HASH_SALT) {
    return process.env.LICENSE_HASH_SALT;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("LICENSE_HASH_SALT must be set in production");
  }

  return DEVELOPMENT_HASH_SALT;
}

export async function hashDesktopSecret(value: string, purpose: DesktopSecretPurpose) {
  const normalized = purpose === "machine" ? normalizeMachineCode(value) : value.trim();

  return createHash("sha256").update(`${purpose}:${getHashSalt()}:${normalized}`).digest("hex");
}
