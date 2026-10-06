import Link from "next/link";
import { redirect } from "next/navigation";
import type { ActivityType } from "../../../generated/prisma/client";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActivityRow from "@/components/ActivityRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activities · e-GURO Companion" };

const FILTERS: { key: string; label: string; type?: ActivityType }[] = [
  { key: "all", label: "All" },
  { key: "assignments", label: "Assignments", type: "ASSIGNMENT" },
  { key: "quizzes", label: "Quizzes", type: "QUIZ" },
  { key: "activities", label: "Activities", type: "ACTIVITY" },
  { key: "announcements", label: "Announcements", type: "ANNOUNCEMENT" },
];

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { type } = await searchParams;
  const active = FILTERS.find((f) => f.key === type) ?? FILTERS[0];

  const activities = await getDb().activity.findMany({
    where: { userId: user.id, ...(active.type ? { type: active.type } : {}) },
    orderBy: { detectedAt: "desc" },
    take: 200,
    include: { course: true, notification: { select: { readAt: true } } },
  });

  return (
    <>
      <p className="eyebrow">Activities</p>
      <h1 className="page-title">Activities</h1>
      <nav aria-label="Filter by type" className="filters">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/activities" : `/activities?type=${f.key}`}
            className={f.key === active.key ? "filter is-active" : "filter"} aria-current={f.key === active.key ? "true" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      {activities.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No activities</p>
          <p className="hint">Nothing detected for this filter yet.</p>
        </div>
      ) : (
        <ul className="list">
          {activities.map((a) => (
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
    </>
  );
}
