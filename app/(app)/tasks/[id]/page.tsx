import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import DeleteTaskButton from "@/components/DeleteTaskButton";
import TaskForm from "@/components/TaskForm";
import { PRIORITY_LABEL } from "@/lib/tasks";
import { formatDateTime, timeAgo } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  // userId in the WHERE clause is the ownership check: another student's task is a 404, not a leak.
  const task = await getDb().task.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, description: true, dueDate: true, priority: true, status: true, completedAt: true, createdAt: true, course: { select: { courseCode: true, courseName: true } } },
  });
  if (!task) notFound();

  return (
    <>
      <p className="eyebrow">Tasks</p>
      <h1 className="page-title">{task.status === "DONE" ? "Finished task" : "Edit task"}</h1>

      <div className="note-bar">
        <p className="item-meta">
          {task.course ? [task.course.courseCode, task.course.courseName].filter(Boolean).join(" ") : "Personal"}
          {" · "}{PRIORITY_LABEL[task.priority]} priority
          {task.dueDate ? ` · due ${formatDateTime(task.dueDate)}` : ""}
        </p>
        <div className="note-bar-actions">
          <DeleteTaskButton taskId={task.id} />
        </div>
      </div>

      <TaskForm
        taskId={task.id}
        task={{
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
          priority: task.priority,
        }}
      />

      <p className="hint" style={{ marginTop: "1.5rem" }}>
        Added {timeAgo(task.createdAt)}{task.completedAt ? ` · finished ${timeAgo(task.completedAt)}` : ""}.
      </p>
    </>
  );
}