import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type LicenseDurationKind = "trial_3_day" | "month_1" | "month_3" | "year_1";

export type EncryptedLicenseCode = {
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  tag: string;
};

export const licenseDurationOptions: { days: number; kind: LicenseDurationKind; label: string }[] = [
  { days: 3, kind: "trial_3_day", label: "3-day trial" },
  { days: 30, kind: "month_1", label: "1 month" },
  { days: 90, kind: "month_3", label: "3 months" },
  { days: 365, kind: "year_1", label: "1 year" },
];

const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LICENSE_CODE_PATTERN = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/;

export function getLicenseDurationDays(kind: LicenseDurationKind) {
  const option = licenseDurationOptions.find((entry) => entry.kind === kind);

  if (!option) {
    throw new Error("Unsupported license duration");
  }

  return option.days;
}

export function isLicenseDurationKind(value: string): value is LicenseDurationKind {
  return licenseDurationOptions.some((entry) => entry.kind === value);
}

export function formatLicenseCode(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (normalized.length !== 16) {
    throw new Error("License code must contain 16 letters or numbers");
  }

  return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
}

export function assertLicenseCode(value: string) {
  const code = formatLicenseCode(value);

  if (!LICENSE_CODE_PATTERN.test(code)) {
    throw new Error("License code must use the XXXX-XXXX-XXXX-XXXX format");
  }

  return code;
}

export function generateLicenseCode() {
  const bytes = randomBytes(16);
  const raw = Array.from(bytes, (byte) => LICENSE_ALPHABET[byte % LICENSE_ALPHABET.length]).join("");

  return formatLicenseCode(raw);
}

export function maskLicenseCode(value: string) {
  const code = assertLicenseCode(value);
  const parts = code.split("-");

  return `${parts[0]}-****-****-${parts[3]}`;
}

function getEncryptionKey(key: string) {
  const trimmed = key.trim();
  const decoded = /^[a-fA-F0-9]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");

  if (decoded.length !== 32) {
    throw new Error("LICENSE_CODE_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key");
  }

  return decoded;
}

export function getLicenseCodeEncryptionKey() {
  const key = process.env.LICENSE_CODE_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("LICENSE_CODE_ENCRYPTION_KEY must be set to generate or reveal license codes");
  }

  return key;
}

export function encryptLicenseCode(code: string, key: string): EncryptedLicenseCode {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(assertLicenseCode(code), "utf8"), cipher.final()]);

  return {
    algorithm: "aes-256-gcm",
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptLicenseCode(encrypted: EncryptedLicenseCode, key: string) {
  if (encrypted.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported license code encryption algorithm");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(key),
    Buffer.from(encrypted.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
