import { getDb } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { connect, LmsAuthError, LmsFormatError, LmsTemporaryError } from "@/services/lms";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Connect (or reconnect) the student's own e-GURO account.
// We try ONE login with what they typed. Only if e-GURO accepts it do we store the password (encrypted).
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  // At most 3 attempts per hour per student, so a typo-loop cannot lock them out of e-GURO.
  if (await isRateLimited(`lms-connect:${user.id}`, 3, 60 * 60 * 1000)) {
    return jsonError("Too many connection attempts. Wait a while before trying again.", 429);
  }

  const body = await readJson(request);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || username.length > 100 || password.length > 200) {
    return jsonError("Enter your e-GURO username and password.", 400);
  }

  try {
    await connect({ username, password });
  } catch (error) {
    if (error instanceof LmsAuthError) return jsonError("e-GURO did not accept that username and password.", 400);
    if (error instanceof LmsFormatError) {
      return jsonError("e-GURO responded in a way this app does not understand yet. Nothing was saved.", 502);
    }
    if (error instanceof LmsTemporaryError) return jsonError("Could not reach e-GURO right now. Try again later.", 503);
    return jsonError("Could not connect to e-GURO. Nothing was saved.", 500);
  }

  const data = {
    lmsUsername: username,
    encryptedPassword: encryptSecret(password),
    status: "CONNECTED" as const,
    lastErrorCode: null,
    consecutiveFailures: 0,
    lastSuccessfulLogin: new Date(),
    nextCheckAt: new Date(), // check as soon as the next scheduled run happens
    checkingStartedAt: null,
  };
  const db = getDb();
  const existing = await db.lmsConnection.findUnique({ where: { userId: user.id } });
  if (existing) {
    // Reconnecting keeps baselineDone, so old items are not announced as "new" again.
    // If a different e-GURO account is connected, start fresh with a new silent baseline.
    const sameAccount = existing.lmsUsername === username;
    await db.lmsConnection.update({ where: { userId: user.id }, data: { ...data, baselineDone: sameAccount && existing.baselineDone } });
  } else {
    await db.lmsConnection.create({ data: { userId: user.id, ...data } });
  }
  return Response.json({ ok: true });
}
