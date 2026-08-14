// Session token for the /admin area. Deliberately dependency-free and built on
// Web Crypto only (no node:crypto), because proxy.ts runs on the Edge runtime
// and imports this module too.
//
// This is a "keep out" sign, not real security: the league is a dozen friends,
// so the code below is a short PIN that ships in the repo. Don't put anything
// behind /admin that would actually matter if one of them typed it in.
//
// Optional env vars (Vercel > Project > Settings > Environment Variables):
//   ADMIN_PASSWORD - overrides DEFAULT_PASSWORD below.
//   ADMIN_SECRET   - HMAC key for the session cookie. Falls back to the
//                    password, so changing the password signs you out.

/** Shipped default, so the admin area works with zero configuration. */
const DEFAULT_PASSWORD = "2802";

export const ADMIN_COOKIE = "mgl_admin";

/** 30 days, long enough to survive a draft weekend without re-logging in. */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function adminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

function secretKeyMaterial() {
  return process.env.ADMIN_SECRET || adminPassword();
}

function base64url(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKeyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

/** Length-independent comparison, so a wrong guess leaks nothing through response timing. */
function timingSafeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function checkAdminPassword(candidate: string) {
  return timingSafeEqual(candidate, adminPassword());
}

/** Token is `<expiry-ms>.<hmac>` and is self-contained, so there is no session store to keep. */
export async function createAdminToken(now = Date.now()) {
  const expiresAt = now + ADMIN_SESSION_MAX_AGE * 1000;
  return `${expiresAt}.${await sign(String(expiresAt))}`;
}

export async function verifyAdminToken(token: string | undefined | null, now = Date.now()) {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const expiresAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) < now) return false;

  return timingSafeEqual(signature, await sign(expiresAt));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  };
}
