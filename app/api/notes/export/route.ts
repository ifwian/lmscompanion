import { getDb } from "@/lib/db";
import { requireUserApi } from "@/lib/api";

export const dynamic = "force-dynamic";

// "Download all my notes": your notes are yours. Markdown by default, JSON with ?format=json.
export async function GET(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  const notes = await getDb().note.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: "desc" },
    include: { course: { select: { courseCode: true, courseName: true } } },
  });
  const course = (n: (typeof notes)[number]) => (n.course ? [n.course.courseCode, n.course.courseName].filter(Boolean).join(" ") : null);

  if (new URL(request.url).searchParams.get("format") === "json") {
    const json = JSON.stringify(
      notes.map((n) => ({ title: n.title, body: n.body, tags: n.tags, pinned: n.pinned, course: course(n), createdAt: n.createdAt, updatedAt: n.updatedAt })),
      null,
      2,
    );
    return new Response(json, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="egaro-notes.json"' } });
  }

  const md = notes
    .map((n) => `# ${n.title}\n\n${[course(n) && `Course: ${course(n)}`, n.tags.length ? `Tags: ${n.tags.join(", ")}` : null, `Updated: ${n.updatedAt.toISOString()}`].filter(Boolean).join("  \n")}\n\n${n.body}\n`)
    .join("\n---\n\n");
  return new Response(md || "No notes yet.\n", { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="egaro-notes.md"' } });
}
