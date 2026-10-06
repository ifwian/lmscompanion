import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "../../../generated/prisma/client";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActivityRow from "@/components/ActivityRow";
import { sortPending } from "@/lib/ui/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activities · e-GURO Companion" };

const VIEWS = [
  { key: "pending", label: "Pending", where: { lmsStatus: { not: null } } },
  { key: "unread", label: "Unread", where: { lmsStatus: null, isUnread: true } },
  { key: "read", label: "Read", where: { lmsStatus: null, isUnread: false } },
  { key: "all", label: "All", where: {} },
] as const satisfies readonly { key: string; label: string; where: Prisma.ActivityWhereInput }[];

const TYPES: { key: string; label: string; where: Prisma.ActivityWhereInput }[] = [
  { key: "all", label: "All types", where: {} },
  { key: "activities", label: "Activities", where: { type: "ACTIVITY", isMaterial: false } },
  { key: "assessments", label: "Assessments", where: { type: "QUIZ" } },
  { key: "lessons", label: "Lessons", where: { isMaterial: true } },
  { key: "announcements", label: "Announcements", where: { type: "ANNOUNCEMENT" } },
];

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ view?: string; type?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.view) ?? VIEWS[0];
  const type = TYPES.find((t) => t.key === params.type) ?? TYPES[0];
  const db = getDb();

  const href = (v: string, t: string) => `/activities?view=${v}${t === "all" ? "" : `&type=${t}`}`;
  const [counts, rows] = await Promise.all([
    Promise.all(VIEWS.map((v) => db.activity.count({ where: { userId: user.id, ...v.where, ...type.where } }))),
    db.activity.findMany({
      where: { userId: user.id, ...view.where, ...type.where },
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { detectedAt: "desc" }],
      take: 200,
      include: { course: true, notification: { select: { readAt: true } } },
    }),
  ]);
  const activities = view.key === "pending" ? sortPending(rows) : rows;

  return (
    <>
      <p className="eyebrow">Activities</p>
      <h1 className="page-title">Activities</h1>

      <nav aria-label="Show" className="filters">
        {VIEWS.map((v, i) => (
          <Link key={v.key} href={href(v.key, type.key)} className={v.key === view.key ? "filter is-active" : "filter"} aria-current={v.key === view.key ? "true" : undefined}>
            {v.label} <span className="filter-count">{counts[i]}</span>
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter by type" className="filters filters-quiet">
        {TYPES.map((t) => (
          <Link key={t.key} href={href(view.key, t.key)} className={t.key === type.key ? "filter is-active" : "filter"} aria-current={t.key === type.key ? "true" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {activities.length === 0 ? (
        <div className="empty">
          <p className="empty-title">{view.key === "pending" ? "Nothing pending" : "Nothing here"}</p>
          <p className="hint">
            {view.key === "pending" ? "You're all caught up, or no check has run yet." : "Nothing matches this filter."}
          </p>
        </div>
      ) : (
        <ul className="list">
          {activities.map((a) => (
            <ActivityRow key={a.id} type={a.type} lmsType={a.lmsType} isMaterial={a.isMaterial} title={a.title}
              courseLabel={a.course ? [a.course.courseCode, a.course.courseName].filter(Boolean).join(" ") : null}
              detectedAt={a.detectedAt} postedAt={a.postedAt} dueDate={a.dueDate} url={a.url} status={a.lmsStatus} isUnread={a.isUnread}
              isNew={a.notification ? a.notification.readAt === null : false} />
          ))}
        </ul>
      )}
    </>
  );
}
