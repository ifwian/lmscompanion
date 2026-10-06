import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActionButton from "@/components/ActionButton";
import ActivityRow from "@/components/ActivityRow";
import ConnectionPanel from "@/components/ConnectionPanel";
import { greeting, timeAgo } from "@/lib/ui/format";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview · e-GURO Companion" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const db = getDb();

  // Every query below filters by userId.
  const [connection, unread, courseCount, recent] = await Promise.all([
    db.lmsConnection.findUnique({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.course.count({ where: { userId: user.id } }),
    db.activity.findMany({
      where: { userId: user.id },
      orderBy: { detectedAt: "desc" },
      take: 8,
      include: { course: true, notification: { select: { readAt: true } } },
    }),
  ]);

  const firstName = user.name.split(" ")[0];
  const canCheck = connection && connection.encryptedPassword && connection.status !== "AUTH_ERROR";

  return (
    <>
      <p className="eyebrow">Overview</p>
      <h1 className="page-title">{greeting()}, <em>{firstName}.</em></h1>

      <section aria-label="Summary" className="stats">
        <div className="stat"><p className="stat-number">{String(unread).padStart(2, "0")}</p><p className="label">New</p></div>
        <div className="stat"><p className="stat-number">{String(courseCount).padStart(2, "0")}</p><p className="label">Courses</p></div>
        <div className="stat"><p className="stat-text">{timeAgo(connection?.lastCheckedAt)}</p><p className="label">Last check</p></div>
      </section>

      <div className="columns">
        <section aria-labelledby="recent-title">
          <div className="section-head"><span className="idx">01</span><h2 id="recent-title" className="label">Recent activity</h2></div>
          {recent.length === 0 ? (
            <div className="empty">
              <p className="empty-title">{connection ? "Nothing detected yet" : "No activity yet"}</p>
              <p className="hint">
                {connection
                  ? "New e-GURO items will show up here after the next check."
                  : "Connect your e-GURO account in Settings to start monitoring."}
              </p>
            </div>
          ) : (
            <ul className="list">
              {recent.map((a) => (
                <ActivityRow
                  key={a.id}
                  type={a.type}
                  title={a.title}
                  courseLabel={a.course ? [a.course.courseCode, a.course.courseName].filter(Boolean).join(" ") : null}
                  detectedAt={a.detectedAt}
                  dueDate={a.dueDate}
                  url={a.url}
                  isNew={a.notification ? a.notification.readAt === null : false}
                />
              ))}
            </ul>
          )}
          {recent.length > 0 && unread === 0 && <p className="hint">You&apos;re all caught up.</p>}
        </section>

        <aside aria-label="Connection">
          <ConnectionPanel connection={connection} />
          {canCheck && <ActionButton url="/api/lms/check-now" label="Check now" busyLabel="Checking…" />}
        </aside>
      </div>
    </>
  );
}
