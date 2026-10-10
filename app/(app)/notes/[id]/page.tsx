import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import NoteEditor from "@/components/NoteEditor";
import { NOTE_LIMITS } from "@/lib/notes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Note · e-GURO Companion" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const db = getDb();

  // userId in the query = ownership check. Someone else's note id simply is not found.
  const note = await db.note.findFirst({ where: { id, userId: user.id }, include: { activity: { select: { title: true } } } });
  if (!note) notFound();
  const courses = await db.course.findMany({ where: { userId: user.id }, orderBy: { courseName: "asc" } });

  return (
    <NoteEditor
      note={{
        id: note.id,
        title: note.title,
        body: note.body,
        tags: note.tags,
        pinned: note.pinned,
        courseId: note.courseId,
        updatedAt: note.updatedAt.toISOString(),
        activityTitle: note.activity?.title ?? null,
      }}
      courses={courses.map((c) => ({ id: c.id, label: [c.courseCode, c.courseName].filter(Boolean).join(" ") }))}
      limits={{ titleMax: NOTE_LIMITS.titleMax, bodyMax: NOTE_LIMITS.bodyMax }}
    />
  );
}
