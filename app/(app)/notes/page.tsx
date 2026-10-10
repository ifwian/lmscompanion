import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "../../../generated/prisma/client";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import NewNoteButton from "@/components/NewNoteButton";
import { timeAgo } from "@/lib/ui/format";
import { snippet } from "@/lib/notes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes · e-GURO Companion" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string; course?: string; tag?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { q = "", course = "", tag = "" } = await searchParams;
  const db = getDb();

  // Every query below filters by userId.
  const where: Prisma.NoteWhereInput = {
    userId: user.id,
    ...(course ? { courseId: course } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q.trim() ? { OR: [{ title: { contains: q.trim(), mode: "insensitive" } }, { body: { contains: q.trim(), mode: "insensitive" } }] } : {}),
  };
  const [notes, courses, allTags, total] = await Promise.all([
    // ownership: ok - "where" is built above and always starts with userId
    db.note.findMany({ where, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: 100, include: { course: true } }),
    db.course.findMany({ where: { userId: user.id }, orderBy: { courseName: "asc" } }),
    db.note.findMany({ where: { userId: user.id }, select: { tags: true } }),
    db.note.count({ where: { userId: user.id } }),
  ]);
  const tagList = [...new Set(allTags.flatMap((n) => n.tags))].sort().slice(0, 30);
  const label = (c: { courseCode: string | null; courseName: string }) => [c.courseCode, c.courseName].filter(Boolean).join(" ");
  const href = (next: { q?: string; course?: string; tag?: string }) => {
    const params = new URLSearchParams();
    const merged = { q, course, tag, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/notes?${s}` : "/notes";
  };
  const filtered = Boolean(q.trim() || course || tag);

  return (
    <>
      <p className="eyebrow">Notes</p>
      <div className="page-head">
        <h1 className="page-title">Notes</h1>
        <NewNoteButton courseId={course || undefined} />
      </div>

      <form className="note-search" method="get" action="/notes" role="search">
        <label className="visually-hidden" htmlFor="q">Search notes</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search your notes" />
        {course && <input type="hidden" name="course" value={course} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="button button-small" type="submit">Search</button>
      </form>

      {courses.length > 0 && (
        <nav aria-label="Filter by course" className="filters">
          <Link href={href({ course: "" })} className={!course ? "filter is-active" : "filter"}>All courses</Link>
          {courses.map((c) => <Link key={c.id} href={href({ course: c.id })} className={course === c.id ? "filter is-active" : "filter"}>{c.courseCode ?? c.courseName}</Link>)}
        </nav>
      )}
      {tagList.length > 0 && (
        <nav aria-label="Filter by tag" className="filters filters-quiet">
          {tag && <Link href={href({ tag: "" })} className="filter">Clear tag</Link>}
          {tagList.map((t) => <Link key={t} href={href({ tag: t })} className={tag === t ? "filter is-active" : "filter"}>#{t}</Link>)}
        </nav>
      )}

      {notes.length === 0 ? (
        <div className="empty">
          <p className="empty-title">{filtered ? "No notes match" : "No notes yet"}</p>
          <p className="hint">{filtered ? "Try a different search or clear the filters." : "Write lecture notes, reminders or study guides. You can link a note to a course or to an e-GURO activity."}</p>
        </div>
      ) : (
        <ul className="list">
          {notes.map((n) => (
            <li className="item" key={n.id}>
              <span className={n.pinned ? "badge badge-assigned" : "badge"}>{n.pinned ? "Pinned" : "Note"}</span>
              <div className="item-main">
                <p className="item-meta">{n.course ? label(n.course) : "No course"}{n.tags.length ? ` · ${n.tags.map((t) => "#" + t).join(" ")}` : ""}</p>
                <p className="item-title"><Link href={`/notes/${n.id}`}>{n.title}</Link></p>
                {n.body && <p className="note-snippet">{snippet(n.body)}</p>}
                <p className="item-meta">Updated {timeAgo(n.updatedAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="hint" style={{ marginTop: "2rem" }}>
        {total} note{total === 1 ? "" : "s"}. {total > 0 && <>Download all: <a href="/api/notes/export">Markdown</a> · <a href="/api/notes/export?format=json">JSON</a></>}
      </p>
    </>
  );
}
