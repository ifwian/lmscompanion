import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import DeleteTaskButton from "@/components/DeleteTaskButton";
import TaskToggle from "@/components/TaskToggle";
import { PRIORITY_LABEL, sortTasks } from "@/lib/tasks";
import { dueIn, timeAgo } from "@/lib/ui/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks · e-GURO Companion" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { view = "open" } = await searchParams;
  const db = getDb();

  // Every query below filters by userId.
  const statusFilter = view === "open" ? { status: "OPEN" as const } : view === "done" ? { status: "DONE" as const } : {};
  const [tasks, openCount, doneCount] = await Promise.all([
    db.task.findMany({ where: { userId: user.id, ...statusFilter }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 300, include: { course: true } }),
    db.task.count({ where: { userId: user.id, status: "OPEN" } }),
    db.task.count({ where: { userId: user.id, status: "DONE" } }),
  ]);
  const ordered = sortTasks(tasks);
  const courseLabel = (c: { courseCode: string | null; courseName: string }) => [c.courseCode, c.courseName].filter(Boolean).join(" ");
  const filterHref = (next: string) => (next === "open" ? "/tasks" : `/tasks?view=${next}`);

  return (
    <>
      <p className="eyebrow">Tasks</p>
      <div className="page-head">
        <h1 className="page-title">My tasks</h1>
        <Link href="/tasks/new" className="button button-small">New task</Link>
      </div>

      <nav aria-label="Filter tasks" className="filters">
        <Link href={filterHref("open")} className={view === "open" ? "filter is-active" : "filter"}>Open ({openCount})</Link>
        <Link href={filterHref("done")} className={view === "done" ? "filter is-active" : "filter"}>Done ({doneCount})</Link>
        <Link href={filterHref("all")} className={view === "all" ? "filter is-active" : "filter"}>All ({openCount + doneCount})</Link>
      </nav>

      {ordered.length === 0 ? (
        <div className="empty">
          <p className="empty-title">{view === "done" ? "Nothing finished yet" : view === "all" ? "No tasks yet" : "Nothing on your list"}</p>
          <p className="hint">
            {view === "done"
              ? "Tasks you finish will be listed here."
              : "Add the things your teachers do not assign: group work, lab gear, reading, anything you need to remember."}
          </p>
        </div>
      ) : (
        <ul className="list">
          {ordered.map((task) => {
            const overdue = task.status === "OPEN" && task.dueDate && task.dueDate.getTime() < Date.now();
            return (
              <li className="item" key={task.id}>
                <TaskToggle taskId={task.id} done={task.status === "DONE"} />
                <div className="item-main">
                  <p className="item-meta">
                    {task.course ? courseLabel(task.course) : "Personal"}
                    {task.priority !== "NORMAL" ? ` · ${PRIORITY_LABEL[task.priority]} priority` : ""}
                  </p>
                  <p className={`item-title${task.status === "DONE" ? " is-done" : ""}`}><Link href={`/tasks/${task.id}`}>{task.title}</Link></p>
                  {task.description && <p className="note-snippet">{task.description}</p>}
                  <p className="item-meta">
                    {task.dueDate ? (overdue ? `Overdue · was ${dueIn(task.dueDate)}` : `Due ${dueIn(task.dueDate)}`) : "No due date"}
                    {task.completedAt ? ` · finished ${timeAgo(task.completedAt)}` : ` · added ${timeAgo(task.createdAt)}`}
                  </p>
                </div>
                <DeleteTaskButton taskId={task.id} />
              </li>
            );
          })}
        </ul>
      )}

      <p className="hint" style={{ marginTop: "2rem" }}>
        {openCount} open, {doneCount} done. e-GURO assignments are on the <Link href="/activities?view=pending">Activities</Link> page.
      </p>
    </>
  );
}