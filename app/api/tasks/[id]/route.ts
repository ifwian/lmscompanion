import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { cleanDueDate, cleanPriority, cleanStatus, validateDescription, validateTitle } from "@/lib/tasks";
import type { TaskPriority, TaskStatus } from "../../../../generated/prisma/client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  // userId in the WHERE clause IS the ownership check: another student's task reads as "not found".
  const task = await getDb().task.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true, title: true, description: true, dueDate: true, priority: true, status: true, courseId: true, activityId: true, completedAt: true, createdAt: true, updatedAt: true },
  });
  if (!task) return jsonError("Task not found.", 404);
  return Response.json({ ok: true, task });
}

// Update a personal task. Only the fields present in the body are changed.
export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  if (await isRateLimited(`tasks:${userId}`, 120, 60_000)) return jsonError("Slow down a little.", 429);

  const { id } = await context.params;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request.", 400);

  const data: { title?: string; description?: string | null; dueDate?: Date | null; priority?: TaskPriority; status?: TaskStatus; completedAt?: Date | null } = {};

  if ("title" in body) {
    const problem = validateTitle(body.title);
    if (problem) return jsonError(problem, 400);
    data.title = (body.title as string).replace(/\s+/g, " ").trim();
  }
  if ("description" in body) {
    const problem = validateDescription(body.description);
    if (problem) return jsonError(problem, 400);
    data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if ("dueDate" in body) {
    const due = cleanDueDate(body.dueDate);
    if (!due.ok) return jsonError(due.message, 400);
    data.dueDate = due.date;
  }
  if ("priority" in body) {
    const priority = cleanPriority(body.priority);
    if (priority === null || priority === undefined) return jsonError("Invalid priority.", 400);
    data.priority = priority;
  }
  if ("status" in body) {
    const status = cleanStatus(body.status);
    if (status === null || status === undefined) return jsonError("Invalid status.", 400);
    data.status = status;
    // Keep the two in step so "done" always has a time and "open" never does.
    data.completedAt = status === "DONE" ? new Date() : null;
  }

  // One write scoped to the owner. count 0 means the task is not theirs (or is gone).
  const written = await getDb().task.updateMany({ where: { id, userId }, data });
  if (written.count === 0) return jsonError("Task not found.", 404);
  const fresh = await getDb().task.findFirst({ where: { id, userId }, select: { updatedAt: true } });
  return Response.json({ ok: true, updatedAt: (fresh?.updatedAt ?? new Date()).toISOString() });
}

export async function DELETE(request: Request, context: Ctx) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const result = await getDb().task.deleteMany({ where: { id, userId: auth.user.id } });
  if (result.count === 0) return jsonError("Task not found.", 404);
  return Response.json({ ok: true });
}