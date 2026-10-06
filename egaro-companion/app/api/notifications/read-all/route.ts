import { getDb } from "@/lib/db";
import { requireUserApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const result = await getDb().notification.updateMany({
    where: { userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true, updated: result.count });
}
