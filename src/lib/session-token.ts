import { createHmac, timingSafeEqual } from "node:crypto";

// Signed value for the demo "acting user" cookie: "<user uuid>.<hmac>".
// Kept free of Next.js and database imports so the proxy and unit tests can
// use it directly.
export const ACTING_USER_COOKIE = "am-acting-user";

const DEV_SECRET = "dev-only-session-secret-do-not-use-in-production";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SESSION_SECRET is required in production. Outside production a fixed dev
// secret is used so local setup works without extra config.
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  return DEV_SECRET;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function mac(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

export function signSessionValue(userId: string, secret: string): string {
  if (!isUuid(userId)) {
    throw new Error("Session user id must be a UUID.");
  }
  return `${userId}.${mac(userId, secret)}`;
}

// Returns the user id when the value is well formed and the signature matches,
// otherwise null. Any malformed value counts as signed out.
export function verifySessionValue(value: string | null | undefined, secret: string): string | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const userId = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!isUuid(userId)) return null;
  const expected = Buffer.from(mac(userId, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? userId : null;
}
