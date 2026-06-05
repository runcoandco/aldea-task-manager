import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { authSecret, type AldeaUser } from "./config";

export const COOKIE_NAME = "aldea_session";

type SessionPayload = {
  user: AldeaUser;
  exp: number;
};

function base64UrlEncode(value: string | Uint8Array) {
  const input = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  return input.toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signaturesMatch(value: string, expected: string) {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function hmac(value: string) {
  return crypto.subtle.importKey(
    "raw",
    Buffer.from(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  ).then((key) => crypto.subtle.sign("HMAC", key, Buffer.from(value)));
}

export async function createSessionToken(user: AldeaUser) {
  const payload: SessionPayload = {
    user,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(new Uint8Array(await hmac(encodedPayload)));
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = base64UrlEncode(new Uint8Array(await hmac(encodedPayload)));
  if (!signaturesMatch(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload.user;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(user: AldeaUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await createSessionToken(user), {
    ...sessionCookieOptions(),
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/"
  };
}
