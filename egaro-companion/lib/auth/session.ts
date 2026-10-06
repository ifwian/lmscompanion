// Sessions: after login we put a signed token (JWT) in an HttpOnly cookie.
// HttpOnly = JavaScript on the page cannot read it, which limits damage from XSS.
// The token only holds the user id and an expiry; it is signed with AUTH_SECRET so it can't be forged.
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const SESSION_COOKIE = "egaro_session";
const SESSION_DAYS = 7;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short (need at least 32 characters). See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecretKey());
}

// Returns the user id and issue time if the token is valid and not expired, otherwise null.
export async function readSession(token: string | undefined): Promise<{ userId: string; issuedAt: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.iat !== "number") return null;
    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return null; // bad signature, expired, or malformed
  }
}

export async function readSessionToken(token: string | undefined): Promise<string | null> {
  return (await readSession(token))?.userId ?? null;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// The server-side check every protected page and API route must use.
// It re-reads the user from the database, so a deleted account stops working immediately.
export async function getCurrentUser() {
  const store = await cookies();
  const session = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getDb().user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, passwordChangedAt: true }, // never select passwordHash here
  });
  if (!user) return null;
  // Changing the password invalidates every older session (including a stolen one).
  if (user.passwordChangedAt && session.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) return null;
  return { id: user.id, name: user.name, email: user.email };
}
