import { randomBytes } from "node:crypto";

export function generateDesktopSecret(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}
