// Builds the stable "have we seen this before?" key for an LMS item.
import { createHash } from "node:crypto";
import type { LmsActivity } from "@/services/lms";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function fingerprintFor(item: LmsActivity): string {
  // Best case: e-GURO gave the item an id. Same id + same type = same item, even if the title is edited.
  if (item.lmsActivityId) return `lms:${item.lmsType ?? "unknown"}:${item.lmsActivityId}`;
  // Fallback: hash the fields that identify the item (due date is left out because teachers often move it).
  const basis = [item.lmsCourseId ?? "", item.type, normalize(item.title)].join("|");
  return `hash:${createHash("sha256").update(basis).digest("hex")}`;
}
