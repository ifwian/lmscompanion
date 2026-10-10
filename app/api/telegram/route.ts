import { getDb } from "@/lib/db";
import { jsonError, requireUserApi } from "@/lib/api";

export const dynamic = "force-dynamic";

// What the Settings page shows: linked or not, and whether reminders are switched on.
export async function GET(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const link = await getDb().telegramLink.findUnique({
    where: { userId: auth.user.id },
    select: { chatUsername: true, linkedAt: true },
  });
  const prefs = await getDb().notificationPreference.findUnique({
    where: { userId: auth.user.id },
    select: { telegramEnabled: true },
  });
  return Response.json({
    ok: true,
    linked: Boolean(link),
    chatUsername: link?.chatUsername ?? null,
    linkedAt: link?.linkedAt.toISOString() ?? null,
    enabled: prefs?.telegramEnabled ?? false,
  });
}

// Removes the link and turns reminders off, so unlinking really does stop everything.
export async function DELETE(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  const db = getDb();
  const result = await db.telegramLink.deleteMany({ where: { userId } });
  await db.telegramLinkCode.deleteMany({ where: { userId, usedAt: null } });
  await db.notificationPreference.upsert({ where: { userId }, update: { telegramEnabled: false }, create: { userId, telegramEnabled: false } });
  return Response.json({ ok: true, removed: result.count });
}