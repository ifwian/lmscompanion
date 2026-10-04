import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";

export const dynamic = "force-dynamic";

// Only these four switches can be changed. Daily summary is not available yet.
const FIELDS = ["activitiesEnabled", "quizzesEnabled", "assignmentsEnabled", "announcementsEnabled"] as const;

export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request.", 400);

  const data: Partial<Record<(typeof FIELDS)[number], boolean>> = {};
  for (const field of FIELDS) {
    if (field in body) {
      if (typeof body[field] !== "boolean") return jsonError("Invalid value.", 400);
      data[field] = body[field] as boolean;
    }
  }
  const prefs = await getDb().notificationPreference.upsert({
    where: { userId: auth.user.id },
    update: data,
    create: { userId: auth.user.id, ...data },
  });
  return Response.json({ ok: true, preferences: prefs });
}
