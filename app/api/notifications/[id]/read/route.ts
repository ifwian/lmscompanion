import { getDb } from "@/lib/db";
import { jsonError, requireUserApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  // The userId in the WHERE clause is the ownership check: someone else's id simply matches nothing.
  const result = await getDb().notification.updateMany({
    where: { id, userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await getDb().notification.findFirst({ where: { id, userId: auth.user.id }, select: { id: true } });
    if (!exists) return jsonError("Notification not found.", 404);
  }
  return Response.json({ ok: true });
}
