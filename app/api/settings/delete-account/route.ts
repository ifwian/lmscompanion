import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { isRateLimited } from "@/lib/auth/request-guards";
import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// "Delete my account": removes the student, their stored (encrypted) e-GURO password, courses, activities and
// notifications. The database deletes everything linked to the user in one go (ON DELETE CASCADE).
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  if (await isRateLimited(`delete:${auth.user.id}`, 5, 15 * 60 * 1000)) return jsonError("Too many attempts. Try again in a few minutes.", 429);

  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  const db = getDb();
  const row = await db.user.findUnique({ where: { id: auth.user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(password, row.passwordHash))) return jsonError("Your password is incorrect.", 400);

  await db.user.delete({ where: { id: auth.user.id } });
  await clearSessionCookie();
  return Response.json({ ok: true });
}
