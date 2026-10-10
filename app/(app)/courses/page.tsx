import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { LMS_CAPABILITIES } from "@/services/lms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses · e-GURO Companion" };

export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const courses = await getDb().course.findMany({ where: { userId: user.id }, orderBy: { courseName: "asc" } });

  return (
    <>
      <p className="eyebrow">Courses</p>
      <h1 className="page-title">Courses</h1>
      {courses.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No courses yet</p>
          <p className="hint">
            {LMS_CAPABILITIES.courses
              ? "Courses appear here after your first check."
              : "This app cannot read course names from e-GURO yet, so this list stays empty for now."}
          </p>
        </div>
      ) : (
        <ul className="list">
          {courses.map((c) => (
            <li className="item" key={c.id}>
              <div className="item-main">
                <p className="item-meta mono">{c.courseCode ?? ""}</p>
                <p className="item-title">{c.courseName}</p>
                <p className="item-meta"><Link href={`/notes?course=${c.id}`}>Notes for this course →</Link></p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
