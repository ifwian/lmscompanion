import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { jsonError, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { isTelegramConfigured, LINK_CODE_ATTEMPTS, LINK_CODE_TTL_MS } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Ambiguous letters are left out on purpose: the student types this by hand in Telegram.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function newCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

// Creates a one-time code the student sends to the bot as /start <code>. Only its hash is stored.
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  if (!isTelegramConfigured()) return jsonError("Telegram is not set up on this server.", 503);
  const userId = auth.user.id;
  if (await isRateLimited(`tg-link:${userId}`, LINK_CODE_ATTEMPTS, 60 * 60 * 1000)) {
    return jsonError("You asked for several codes already. Wait an hour and try again.", 429);
  }

  const code = newCode();
  const db = getDb();
  // Any earlier unused code stops working the moment a new one is made.
  await db.telegramLinkCode.deleteMany({ where: { userId, usedAt: null } });
  await db.telegramLinkCode.create({
    data: { userId, codeHash: createHash("sha256").update(code).digest("hex"), expiresAt: new Date(Date.now() + LINK_CODE_TTL_MS) },
  });

  return Response.json({ ok: true, code, expiresInMinutes: Math.round(LINK_CODE_TTL_MS / 60000) });
}