// Turns e-GURO's raw JSON into our own types. Pure functions (no network), so they are easy to test.
//
// ASSUMPTIONS (taken from the old Python prototype, to be re-checked against the current site):
//  - the response looks like { "data": [ { class_exam_id, title, mark_type, from_date, to_date }, ... ] }
//  - the course of an item is NOT part of that response, so courses stay empty for now
import { LmsFormatError } from "./errors";
import type { ActivityKind, LmsActivity } from "./types";

// ASSUMPTION: how e-GURO's type labels map to our four kinds. Unknown labels become a plain "activity".
const KIND_BY_LMS_TYPE: Record<string, ActivityKind> = {
  ACTIVITY_QUIZ: "QUIZ",
  SUBMIT_ANSWER: "ASSIGNMENT",
};

export function kindForLmsType(lmsType: string): ActivityKind {
  return KIND_BY_LMS_TYPE[lmsType] ?? "ACTIVITY";
}

// e-GURO dates look like "2026-10-05 23:59:00" with no time zone. We assume Philippine time (UTC+8).
export function parseLmsDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const text = value.trim();
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text);
  const date = new Date(naive ? text.replace(" ", "T") + "+08:00" : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function parseActivityList(json: unknown, lmsType: string): LmsActivity[] {
  if (!json || typeof json !== "object" || !Array.isArray((json as { data?: unknown }).data)) {
    throw new LmsFormatError("Activity list is not in the expected format.");
  }
  const items: LmsActivity[] = [];
  for (const raw of (json as { data: unknown[] }).data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const title = cleanText(row.title, 300);
    if (!title) continue; // never invent a title
    const id = row.class_exam_id;
    items.push({
      lmsActivityId: typeof id === "string" || typeof id === "number" ? String(id) : null,
      lmsType,
      type: kindForLmsType(lmsType),
      title,
      description: null, // not provided by the list endpoint
      url: null, // no verified item URL yet
      dueDate: parseLmsDate(row.to_date),
      lmsCourseId: null, // see assumptions above
    });
  }
  return items;
}
