import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { cleanTags, validateBody, validateTitle } from "@/lib/notes";

export const dynamic = "force-dynamic";

// Update a note. The browser sends the "updatedAt" it last saw; if the note changed somewhere else since
// (another tab or device) we refuse with 409 instead of silently overwriting that newer text.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  if (await isRateLimited(`notes:${userId}`, 240, 60_000)) return jsonError("Slow down a little.", 429);

  const { id } = await context.params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request.", 400);
  const db = getDb();

  // The userId in the WHERE clause is the ownership check: someone else's note is simply "not found".
  const note = await db.note.findFirst({ where: { id, userId }, select: { updatedAt: true } });
  if (!note) return jsonError("Note not found.", 404);
  if (typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt !== note.updatedAt.toISOString()) {
    return jsonError("This note was changed somewhere else. Reload the page to see the newest version.", 409);
  }

  const data: { title?: string; body?: string; tags?: string[]; pinned?: boolean; courseId?: string | null } = {};
  if ("title" in body) {
    const problem = validateTitle(body.title);
    if (problem) return jsonError(problem, 400);
    data.title = (body.title as string).replace(/\s+/g, " ").trim();
  }
  if ("body" in body) {
    const problem = validateBody(body.body);
    if (problem) return jsonError(problem, 400);
    data.body = body.body as string;
  }
  if ("tags" in body) {
    const tags = cleanTags(body.tags);
    if (!tags) return jsonError("The tags are not valid.", 400);
    data.tags = tags;
  }
  if ("pinned" in body) {
    if (typeof body.pinned !== "boolean") return jsonError("Invalid value.", 400);
    data.pinned = body.pinned;
  }
  if ("courseId" in body) {
    if (body.courseId === null || body.courseId === "") data.courseId = null;
    else if (typeof body.courseId === "string") {
      const course = await db.course.findFirst({ where: { id: body.courseId, userId }, select: { id: true } });
      if (!course) return jsonError("That course was not found.", 400);
      data.courseId = course.id;
    } else return jsonError("Invalid value.", 400);
  }

  // One atomic write, scoped to the owner AND to the version the browser saw: if someone else saved in between,
  // nothing is written (count 0) and the browser is told to reload.
  const expected = typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : null;
  const written = await db.note.updateMany({ where: { id, userId, ...(expected && !Number.isNaN(expected.getTime()) ? { updatedAt: expected } : {}) }, data });
  if (written.count === 0) return jsonError("This note was changed somewhere else. Reload the page to see the newest version.", 409);
  const fresh = await db.note.findFirst({ where: { id, userId }, select: { updatedAt: true } });
  return Response.json({ ok: true, updatedAt: (fresh?.updatedAt ?? new Date()).toISOString() });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const result = await getDb().note.deleteMany({ where: { id, userId: auth.user.id } });
  if (result.count === 0) return jsonError("Note not found.", 404);
  return Response.json({ ok: true });
}
