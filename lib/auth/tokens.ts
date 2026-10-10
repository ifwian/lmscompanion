// One-time links sent by email: "confirm your email" and "reset your password".
// The email contains a random token; the database only keeps its SHA-256 hash, so a leaked database
// cannot be used to reset anyone's password. Each token works once and expires.
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

export type TokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

const LIFETIME_MS: Record<TokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(userId: string, type: TokenType): Promise<string> {
  const db = getDb();
  // Only the newest link works: remove older unused ones.
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = randomBytes(32).toString("hex");
  await db.authToken.create({
    data: { userId, type, tokenHash: hash(token), expiresAt: new Date(Date.now() + LIFETIME_MS[type]) },
  });
  return token;
}

// Returns the user id if the token is valid, unused and not expired. Marks it as used (atomically).
export async function consumeAuthToken(token: string, type: TokenType): Promise<string | null> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const db = getDb();
  // ownership: ok - found by the hash of a one-time secret, which only the owner of the address received
  const row = await db.authToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  // ownership: ok - same one-time secret
  const claimed = await db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? row.userId : null;
}
