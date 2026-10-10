import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { NOTE_LIMITS, cleanTags, validateBody, validateTitle } from "@/lib/notes";

export const dynamic = "force-dynamic";

// Create a note. Optional: courseId and/or activityId (must belong to the same student).
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  if (await isRateLimited(`notes:${userId}`, 240, 60_000)) return jsonError("Slow down a little.", 429);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid request.", 400);
  const db = getDb();

  // Links: only to the student's OWN course / activity.
  let courseId: string | null = null;
  let activityTitle: string | null = null;
  if (typeof body.activityId === "string") {
    const activity = await db.activity.findFirst({ where: { id: body.activityId, userId }, select: { id: true, title: true, courseId: true } });
    if (!activity) return jsonError("That activity was not found.", 400);
    activityTitle = activity.title;
    courseId = activity.courseId;
  }
  if (typeof body.courseId === "string") {
    const course = await db.course.findFirst({ where: { id: body.courseId, userId }, select: { id: true } });
    if (!course) return jsonError("That course was not found.", 400);
    courseId = course.id;
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title : activityTitle ? `Notes: ${activityTitle}` : "Untitled note";
  const text = typeof body.body === "string" ? body.body : "";
  const tags = body.tags === undefined ? [] : cleanTags(body.tags);
  const problem = validateTitle(title) ?? validateBody(text) ?? (tags ? null : "The tags are not valid.");
  if (problem) return jsonError(problem, 400);

  if ((await db.note.count({ where: { userId } })) >= NOTE_LIMITS.notesPerStudent) {
    return jsonError(`You have reached the limit of ${NOTE_LIMITS.notesPerStudent} notes. Delete or export some first.`, 409);
  }
  const note = await db.note.create({
    data: {
      userId,
      courseId,
      activityId: typeof body.activityId === "string" ? body.activityId : null,
      title: title.replace(/\s+/g, " ").trim(),
      body: text,
      tags: tags ?? [],
    },
    select: { id: true, updatedAt: true },
  });
  return Response.json({ ok: true, id: note.id, updatedAt: note.updatedAt.toISOString() }, { status: 201 });
}
