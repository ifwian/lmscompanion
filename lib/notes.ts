// Limits and cleaning for notes. They protect the free database (every student shares it) and the page.
export const NOTE_LIMITS = {
  titleMax: 200,
  bodyMax: 30_000, // characters (about 10 printed pages)
  tagMax: 10,
  tagLength: 30,
  notesPerStudent: 500,
} as const;

// "Exam, week 3 , DB" -> ["exam", "week 3", "db"] (lower case, no duplicates, trimmed, limited)
export function cleanTags(input: unknown): string[] | null {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : null;
  if (!list) return null;
  const tags = new Set<string>();
  for (const raw of list) {
    if (typeof raw !== "string") return null;
    const tag = raw.replace(/\s+/g, " ").trim().toLowerCase().slice(0, NOTE_LIMITS.tagLength);
    if (tag) tags.add(tag);
  }
  return [...tags].slice(0, NOTE_LIMITS.tagMax);
}

export function validateTitle(value: unknown): string | null {
  if (typeof value !== "string") return "Give the note a title.";
  const title = value.replace(/\s+/g, " ").trim();
  if (!title) return "Give the note a title.";
  if (title.length > NOTE_LIMITS.titleMax) return `The title can be at most ${NOTE_LIMITS.titleMax} characters.`;
  return null;
}

export function validateBody(value: unknown): string | null {
  if (typeof value !== "string") return "The note text is not valid.";
  if (value.length > NOTE_LIMITS.bodyMax) return `A note can hold at most ${NOTE_LIMITS.bodyMax.toLocaleString()} characters. Split it into two notes.`;
  return null;
}

// First part of the note as plain text for list previews (markdown symbols removed), cut at a word.
export function snippet(body: string, length = 140): string {
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[ xX]\]/g, " ") // task-list boxes
    .replace(/[#>*_`~\[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= length) return text;
  return text.slice(0, length).replace(/\s+\S*$/, "") + "…";
}
