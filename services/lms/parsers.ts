// Turns e-GURO's raw responses into our own types. Pure functions (no network), so they are easy to test.
//
// What this is based on (real diagnostic reports, October 2026):
//  - /app/table_course.php answers JSON: { last_page, total_record, data: [ rows ] }
//    (last_page and total_record were 0 even when data had rows, so they are not trusted for counting)
//  - a row has: class_exam_id, title, date_added, term, teacher_class_id, exam_type, submit_answer,
//    date_deadline, from_date, to_date, review_date, grade, status, mark_type
//  - rows from the UNREAD list have NO mark_type, so the type of the request is used instead
//  - submit_answer "1" = something to hand in; "0" = reading material (a lesson)
//  - the student's classes are written into the filter page as: var global_class = [ {...}, ... ]
// Not yet confirmed: which of date_deadline / to_date the website shows as "due". The deadline is used first.
// Missing fields are left empty, never invented.
import { LmsFormatError } from "./errors";
import type { ActivityKind, LmsActivity, LmsCourse, PendingStatus } from "./types";

// ASSUMPTION: EXAM rows are shown as "quizzes" (the site calls them "Assessment"); everything else is an "activity".
export function kindForMarkType(markType: string | null): ActivityKind {
  return markType === "EXAM" ? "QUIZ" : "ACTIVITY";
}

// e-GURO dates look like "2026-10-05 23:59:00" with no time zone. We assume Philippine time (UTC+8).
export function parseLmsDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "" || value.startsWith("0000")) return null;
  const text = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T23:59:00+08:00`) // a date without a time: end of that day
    : new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text) ? text.replace(" ", "T") + "+08:00" : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function idText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

// Address of the item, built the same way the e-GURO page builds it when you click a row.
// (id = teacher_class_id, param = class_exam_id, terms = term; this matches the "notif_link" format too.)
function buildItemUrl(baseUrl: string, markType: string | null, classId: string | null, examId: string | null, term: string | null): string | null {
  if (!markType || !classId || classId === "0" || !examId || !term) return null;
  const page = markType === "EXAM" ? "open_exam.php" : "open_lesson.php";
  return `${baseUrl}/app/${page}?id=${encodeURIComponent(classId)}&param=${encodeURIComponent(examId)}&terms=${encodeURIComponent(term)}`;
}

export type ListContext = {
  // The type used in the request (LESSON, EXAM or empty). Used when a row has no mark_type of its own.
  requestType: string;
  // Which list this is: a pending list, or the unread list.
  status: PendingStatus | null;
  unread: boolean;
};

export function parseActivityPage(json: unknown, baseUrl: string, context: ListContext = { requestType: "", status: null, unread: false }): { items: LmsActivity[]; lastPage: number; rowCount: number } {
  const body = json as { data?: unknown; last_page?: unknown } | null;
  if (!body || typeof body !== "object" || !Array.isArray(body.data)) {
    throw new LmsFormatError("Activity list is not in the expected format.");
  }
  const lastPage = Number(body.last_page);
  const items: LmsActivity[] = [];
  for (const raw of body.data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const title = cleanText(row.title, 300);
    if (!title) continue; // never invent a title
    const markType = cleanText(row.mark_type, 30)?.toUpperCase() ?? (context.requestType || null);
    const classId = idText(row.teacher_class_id);
    const examId = idText(row.class_exam_id);
    const submit = idText(row.submit_answer);
    items.push({
      lmsActivityId: examId,
      lmsType: markType,
      type: kindForMarkType(markType),
      title,
      description: null,
      url: buildItemUrl(baseUrl, markType, classId, examId, idText(row.term)),
      // The deadline field first; the old prototype's to_date as a fallback.
      dueDate: parseLmsDate(row.date_deadline) ?? parseLmsDate(row.to_date),
      postedAt: parseLmsDate(row.from_date) ?? parseLmsDate(row.date_added),
      lmsCourseId: classId && classId !== "0" ? classId : null,
      status: context.status,
      unread: context.unread,
      isMaterial: markType !== "EXAM" && submit === "0",
    });
  }
  return { items, lastPage: Number.isFinite(lastPage) ? lastPage : 0, rowCount: body.data.length };
}

// Combines the same item found in several lists: the strongest pending status wins, unread is kept.
const STATUS_RANK: Record<PendingStatus, number> = { MISSED: 3, DUE_TODAY: 2, ASSIGNED: 1 };

export function mergeItems(items: LmsActivity[]): LmsActivity[] {
  const merged = new Map<string, LmsActivity>();
  for (const item of items) {
    const key = `${item.lmsType}:${item.lmsActivityId ?? item.title}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }
    if (item.status && (!existing.status || STATUS_RANK[item.status] > STATUS_RANK[existing.status])) existing.status = item.status;
    existing.unread = existing.unread || item.unread;
    existing.isMaterial = existing.isMaterial && item.isMaterial;
    existing.dueDate = existing.dueDate ?? item.dueDate;
    existing.postedAt = existing.postedAt ?? item.postedAt;
    existing.url = existing.url ?? item.url;
    existing.lmsCourseId = existing.lmsCourseId ?? item.lmsCourseId;
  }
  return [...merged.values()];
}

// Finds "var global_class = [ ... ];" in the filter page and reads the student's classes from it.
// Returns an empty list (not an error) when the page does not contain it.
const CLASS_LIST_MARKER = /\bglobal_class\s*=\s*/;

// True when the page still carries the block e-GURO uses to list classes. Its absence is a different
// situation from "the student simply has no classes": the marker is there, the list behind it is empty.
// Callers use this to tell a changed page apart from an empty one instead of silently saving nothing.
export function hasClassListMarker(html: string): boolean {
  return CLASS_LIST_MARKER.test(html);
}

export function parseCoursesFromPage(html: string): LmsCourse[] {
  const marker = CLASS_LIST_MARKER.exec(html);
  if (!marker) return [];
  const start = marker.index + marker[0].length;
  if (html[start] !== "[") return [];

  // Find the matching closing bracket, skipping over text inside quotes.
  let depth = 0;
  let inString = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return [];

  let list: unknown;
  try {
    list = JSON.parse(html.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];

  const courses = new Map<string, LmsCourse>();
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = idText(row.teacher_class_id);
    if (!id || id === "0") continue; // id 0 is the "ALL CLASS" placeholder
    const code = cleanText(row.subject_code, 60);
    const name = cleanText(row.subject_text, 200) ?? code;
    if (!name) continue;
    courses.set(id, { lmsCourseId: id, courseCode: code, courseName: name });
  }
  return [...courses.values()];
}
