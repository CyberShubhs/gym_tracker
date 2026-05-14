import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gym-session";

export function hashPasscode(userId: string, passcode: string): string {
  return createHash("sha256").update(`${userId}:${passcode}`).digest("hex");
}

export function signSession(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");
  const hmac = createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}:${hmac}`;
}

export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  const userId = value.slice(0, idx);
  const hmac = value.slice(idx + 1);
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  if (expected.length !== hmac.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(hmac))) return null;
  } catch {
    return null;
  }
  return userId;
}
