import { getDb } from "@/lib/db";
import { jsonError, readJson, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { TASK_LIMITS, cleanDueDate, cleanPriority, validateDescription, validateTitle } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// The student's own task list. Every query filters by userId: another student's task is simply not here.
export async function GET(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  const tasks = await getDb().task.findMany({
    where: {
      userId: auth.user.id,
      ...(view === "open" ? { status: "OPEN" as const } : {}),
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 300,
    select: { id: true, title: true, description: true, dueDate: true, priority: true, status: true, completedAt: true, createdAt: true },
  });
  return Response.json({ ok: true, tasks });
}

// Create a personal task. Optionally linked to one of the student's OWN course / activity.
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;
  if (await isRateLimited(`tasks:${userId}`, 120, 60_000)) return jsonError("Slow down a little.", 429);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid request.", 400);

  const titleProblem = validateTitle(body.title);
  if (titleProblem) return jsonError(titleProblem, 400);
  const descriptionProblem = validateDescription(body.description);
  if (descriptionProblem) return jsonError(descriptionProblem, 400);
  const priority = cleanPriority(body.priority) ?? "NORMAL";
  const due = cleanDueDate(body.dueDate);
  if (!due.ok) return jsonError(due.message, 400);

  // Links: only to the student's OWN course / activity, exactly like notes.
  const db = getDb();
  let courseId: string | null = null;
  let activityId: string | null = null;
  if (typeof body.activityId === "string" && body.activityId) {
    const activity = await db.activity.findFirst({ where: { id: body.activityId, userId }, select: { id: true, courseId: true } });
    if (!activity) return jsonError("That activity was not found.", 400);
    activityId = activity.id;
    courseId = activity.courseId;
  }
  if (typeof body.courseId === "string" && body.courseId) {
    const course = await db.course.findFirst({ where: { id: body.courseId, userId }, select: { id: true } });
    if (!course) return jsonError("That course was not found.", 400);
    courseId = course.id;
  }

  if ((await db.task.count({ where: { userId } })) >= TASK_LIMITS.tasksPerStudent) {
    return jsonError(`You have reached the limit of ${TASK_LIMITS.tasksPerStudent} tasks. Delete some first.`, 409);
  }

  const task = await db.task.create({
    data: {
      userId,
      title: (body.title as string).replace(/\s+/g, " ").trim(),
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      dueDate: due.date,
      priority,
      courseId,
      activityId,
    },
    select: { id: true, updatedAt: true },
  });
  return Response.json({ ok: true, id: task.id, updatedAt: task.updatedAt.toISOString() }, { status: 201 });
}