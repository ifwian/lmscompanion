import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActionButton from "@/components/ActionButton";
import ActivityRow from "@/components/ActivityRow";
import ConnectionPanel from "@/components/ConnectionPanel";
import NewNoteButton from "@/components/NewNoteButton";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import TaskToggle from "@/components/TaskToggle";
import { isOnboardingComplete, onboardingSteps } from "@/lib/onboarding";
import { sortTasks } from "@/lib/tasks";
import { dueIn, greeting, sortPending, timeAgo } from "@/lib/ui/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview · e-GURO Companion" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const db = getDb();

  // Every query below filters by userId.
  const include = { course: true, notification: { select: { readAt: true } } } as const;
  const [connection, newAlerts, courseCount, pendingRaw, unreadCount, unreadLessons, recentNotes, activityNotes, myTasks] = await Promise.all([
    db.lmsConnection.findUnique({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.course.count({ where: { userId: user.id } }),
    db.activity.findMany({ where: { userId: user.id, lmsStatus: { not: null } }, include }),
    db.activity.count({ where: { userId: user.id, lmsStatus: null, isUnread: true } }),
    db.activity.findMany({
      where: { userId: user.id, lmsStatus: null, isUnread: true },
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { detectedAt: "desc" }],
      take: 6,
      include,
    }),
    db.note.findMany({ where: { userId: user.id }, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: 4, include: { course: true } }),
    db.note.findMany({ where: { userId: user.id, activityId: { not: null } }, select: { id: true, activityId: true } }),
    db.task.findMany({ where: { userId: user.id, status: "OPEN" }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 5 }),
  ]);
  const noteByActivity = new Map(activityNotes.map((n) => [n.activityId, n.id]));
  const pending = sortPending(pendingRaw);
  const openTasks = sortTasks(myTasks);
  const checkedOnce = Boolean(connection?.baselineDone);
  // Built from the rows already loaded above (user.emailVerifiedAt and the user's own connection), so it adds no queries.
  const onboarding = onboardingSteps({ emailVerifiedAt: user.emailVerifiedAt, connection });
  const showOnboarding = !isOnboardingComplete(onboarding);
  const firstName = user.name.split(" ")[0];
  const canCheck = connection && connection.encryptedPassword && connection.status !== "AUTH_ERROR";
  const courseLabel = (a: (typeof pending)[number]) => (a.course ? [a.course.courseCode, a.course.courseName].filter(Boolean).join(" ") : null);

  return (
    <>
      <p className="eyebrow">Overview</p>
      <h1 className="page-title">{greeting()}, <em>{firstName}.</em></h1>

      {showOnboarding && <OnboardingChecklist steps={onboarding} />}

      <section aria-label="Summary" className="stats stats-4">
        <div className="stat"><p className="stat-number">{String(pending.length).padStart(2, "0")}</p><p className="label">Pending</p></div>
        <div className="stat"><p className="stat-number">{String(unreadCount).padStart(2, "0")}</p><p className="label">Unread lessons</p></div>
        <div className="stat"><p className="stat-number">{String(newAlerts).padStart(2, "0")}</p><p className="label">New alerts</p></div>
        <div className="stat"><p className="stat-number">{String(courseCount).padStart(2, "0")}</p><p className="label">Courses</p></div>
      </section>

      <section className="pending" aria-labelledby="pending-title">
        <div className="pending-head">
          <div>
            <p className="label">Your priority</p>
            <h2 id="pending-title" className="pending-title">Pending activities</h2>
          </div>
          <Link href="/activities?view=pending" className="pending-link">View all →</Link>
        </div>
        {pending.length === 0 ? (
          <div className="empty">
            <p className="empty-title">
              {!connection ? "Not connected yet" : !checkedOnce ? "No check yet" : "Nothing pending"}
            </p>
            <p className="hint">
              {!connection
                ? "Connect your e-GURO account in Settings to see what you still have to do."
                : !checkedOnce
                  ? "Click Check now to load your pending activities from e-GURO."
                  : "You're all caught up. New work will appear here after the next check."}
            </p>
          </div>
        ) : (
          <ul className="list">
            {pending.map((a) => (
              <ActivityRow key={a.id} activityId={a.id} noteId={noteByActivity.get(a.id) ?? null} large type={a.type} lmsType={a.lmsType} isMaterial={a.isMaterial} title={a.title} courseLabel={courseLabel(a)}
                detectedAt={a.detectedAt} postedAt={a.postedAt} dueDate={a.dueDate} url={a.url} status={a.lmsStatus} isUnread={a.isUnread}
                isNew={a.notification ? a.notification.readAt === null : false} />
            ))}
          </ul>
        )}
      </section>

      <div className="columns">
        <section aria-labelledby="unread-title">
          <div className="section-head">
            <span className="idx">02</span>
            <h2 id="unread-title" className="label">Unread lessons</h2>
          </div>
          {unreadLessons.length === 0 ? (
            <div className="empty">
              <p className="empty-title">No unread lessons</p>
              <p className="hint">Lessons you have not opened yet will be listed here, separate from your work.</p>
            </div>
          ) : (
            <>
              <ul className="list">
                {unreadLessons.map((a) => (
                  <ActivityRow key={a.id} activityId={a.id} noteId={noteByActivity.get(a.id) ?? null} type={a.type} lmsType={a.lmsType} isMaterial={a.isMaterial} title={a.title} courseLabel={courseLabel(a)}
                    detectedAt={a.detectedAt} postedAt={a.postedAt} dueDate={a.dueDate} url={a.url} status={a.lmsStatus} isUnread={a.isUnread}
                    isNew={a.notification ? a.notification.readAt === null : false} />
                ))}
              </ul>
              {unreadCount > unreadLessons.length && (
                <p className="hint" style={{ marginTop: "1rem" }}>
                  <Link href="/activities?view=unread">See all {unreadCount} unread lessons →</Link>
                </p>
              )}
            </>
          )}
        </section>

        <aside aria-label="Connection">
          <ConnectionPanel connection={connection} />
          {canCheck && <ActionButton url="/api/lms/check-now" label="Check now" busyLabel="Checking…" />}
        </aside>
      </div>

      <section className="section-notes" aria-labelledby="tasks-title">
        <div className="pending-head">
          <div className="section-head"><span className="idx">03</span><h2 id="tasks-title" className="label">My tasks</h2></div>
          <Link href="/tasks/new" className="button button-quiet button-small">New task</Link>
        </div>
        {openTasks.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nothing on your list</p>
            <p className="hint">Add the things your teachers do not assign: group work, lab gear, reading, anything you need to remember.</p>
          </div>
        ) : (
          <ul className="list">
            {openTasks.map((task) => (
              <li className="item" key={task.id}>
                <TaskToggle taskId={task.id} done={false} />
                <div className="item-main">
                  <p className="item-title"><Link href={`/tasks/${task.id}`}>{task.title}</Link></p>
                  <p className="item-meta">{task.dueDate ? `Due ${dueIn(task.dueDate)}` : "No due date"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {openTasks.length > 0 && <p className="hint" style={{ marginTop: "1rem" }}><Link href="/tasks">All my tasks →</Link></p>}
      </section>

      <section className="section-notes" aria-labelledby="notes-title">
        <div className="pending-head">
          <div className="section-head"><span className="idx">04</span><h2 id="notes-title" className="label">Your notes</h2></div>
          <NewNoteButton small label="New note" />
        </div>
        {recentNotes.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No notes yet</p>
            <p className="hint">Jot down lecture notes or reminders. Use &quot;+ Note&quot; on a pending item to write about it.</p>
          </div>
        ) : (
          <ul className="list">
            {recentNotes.map((n) => (
              <li className="item" key={n.id}>
                <span className={n.pinned ? "badge badge-assigned" : "badge"}>{n.pinned ? "Pinned" : "Note"}</span>
                <div className="item-main">
                  <p className="item-meta">{n.course ? [n.course.courseCode, n.course.courseName].filter(Boolean).join(" ") : "No course"}</p>
                  <p className="item-title"><Link href={`/notes/${n.id}`}>{n.title}</Link></p>
                  <p className="item-meta">Updated {timeAgo(n.updatedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="hint" style={{ marginTop: "1rem" }}><Link href="/notes">All notes →</Link></p>
      </section>
    </>
  );
}
