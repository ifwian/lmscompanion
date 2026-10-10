import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isRateLimited } from "@/lib/auth/request-guards";
import { setSessionCookie } from "@/lib/auth/session";
import { validatePassword } from "@/lib/auth/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  if (await isRateLimited(`password:${auth.user.id}`, 5, 15 * 60 * 1000)) {
    return jsonError("Too many attempts. Try again in a few minutes.", 429);
  }

  const body = await readJson(request);
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = body?.newPassword;
  const problem = validatePassword(next);
  if (problem) return jsonError(problem, 400);

  const db = getDb();
  const row = await db.user.findUnique({ where: { id: auth.user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return jsonError("Your current password is incorrect.", 400);
  }

  // passwordChangedAt invalidates every older session; we then give THIS browser a fresh one.
  await db.user.update({
    where: { id: auth.user.id },
    data: { passwordHash: await hashPassword(next as string), passwordChangedAt: new Date() },
  });
  await setSessionCookie(auth.user.id);
  return Response.json({ ok: true });
}
