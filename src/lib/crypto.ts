import crypto from "crypto";

function pepper() {
  const value = process.env.LICENSE_PEPPER;
  if (!value) throw new Error("LICENSE_PEPPER is required");
  return value;
}

export function hashSecret(value: string) {
  return crypto.createHmac("sha256", pepper()).update(value.trim()).digest("hex");
}

export function hashOptional(value: string | null | undefined) {
  if (!value) return null;
  return hashSecret(value);
}

export function generateGroupedKey(prefix: string) {
  const raw = crypto.randomBytes(18).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const chunks = raw.slice(0, 20).match(/.{1,5}/g) ?? [raw.slice(0, 20)];
  return `${prefix}-${chunks.join("-")}`;
}

export function keyPrefix(value: string) {
  const clean = value.trim().toUpperCase();
  return clean.slice(0, Math.min(clean.length, 10));
}
