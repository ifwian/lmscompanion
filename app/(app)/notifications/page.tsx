import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActionButton from "@/components/ActionButton";
import { TYPE_LABEL, formatDateTime } from "@/lib/ui/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · e-GURO Companion" };

const EMAIL_LABEL = {
  SENT: "Email sent",
  PENDING: "Email pending",
  SKIPPED: "Email off for this type",
  FAILED: "Email failed",
} as const;

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await getDb().notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { activity: { include: { course: true } } },
  });
  const unread = notifications.filter((n) => n.readAt === null).length;

  return (
    <>
      <p className="eyebrow">Notifications</p>
      <h1 className="page-title">Notifications</h1>
      {unread > 0 && <p><ActionButton url="/api/notifications/read-all" label={`Mark all as read (${unread})`} /></p>}
      {notifications.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No notifications</p>
          <p className="hint">You&apos;ll see a notification here each time something new is detected.</p>
        </div>
      ) : (
        <ul className="list">
          {notifications.map((n) => {
            const isNew = n.readAt === null;
            const course = n.activity.course;
            return (
              <li className="item" key={n.id}>
                <span className={isNew ? "badge badge-new" : "badge"}>{isNew ? "New" : "Read"}</span>
                <div className="item-main">
                  <p className="item-meta">{[course ? [course.courseCode, course.courseName].filter(Boolean).join(" ") : null, TYPE_LABEL[n.notificationType]].filter(Boolean).join(" · ")}</p>
                  <p className="item-title">{n.activity.title}</p>
                  <p className="item-meta">{formatDateTime(n.createdAt)} · {EMAIL_LABEL[n.emailStatus]}</p>
                </div>
                {isNew && <ActionButton url={`/api/notifications/${n.id}/read`} label="Mark as read" />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
