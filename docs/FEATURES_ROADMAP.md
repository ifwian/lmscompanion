# Student tools: what exists and what to build next

## Built: Notes (v9)
- **Where:** `Notes` in the menu, a "Your notes" strip on Overview, "+ Note" on any e-GURO item, "Notes for this course" on the Courses page.
- **What:** Markdown notes (headings, lists, to-do boxes, tables, code), Write / Preview tabs, autosave, tags, search, pin, link to a course and/or an e-GURO activity, download all as Markdown or JSON, delete.
- **Safety:** each student only ever sees their own notes (every query filters by `userId`); HTML typed in a note is shown as text, never run; two tabs cannot silently overwrite each other (409 conflict); limits protect the free database (30,000 characters per note, 500 notes per student).
- **Honest limit:** notes are NOT encrypted in the database (so search works). The privacy page says so. Students should not store passwords in notes.

## Data model (already in `prisma/schema.prisma`)
```prisma
model Note {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")          // owner; every query filters on it
  courseId   String?  @map("course_id")        // optional link to one of the student's courses
  activityId String?  @map("activity_id")      // optional link to an e-GURO item
  title      String
  body       String   @default("")             // Markdown source, rendered safely in the browser
  tags       String[] @default([])
  pinned     Boolean  @default(false)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
}
```

## Screens
```
Overview   pending (priority) | unread lessons | your notes (4 newest, "New note")
Notes      search + course filter + tag filter + list (pinned first)  ->  note editor
Activities each row: "+ Note" or "Open your note"
Courses    each course: "Notes for this course"
```

## Next tools, in the order I would build them
Each one reuses what already exists (login, per-student data, the checker, the same look). Build one at a time.

| # | Tool | Why it fits | Data | Effort |
|---|---|---|---|---|
| 1 | **My tasks** (personal to-do list next to e-GURO pending) | The pending list shows only what teachers assign. Students also have their own things to do. Show both on Overview. | `Task { id, userId, title, dueDate?, done, courseId?, activityId?, noteId? }` | Small |
| 2 | **Deadline calendar** | Merge e-GURO due dates and personal tasks into one week/month view. Read-only on top of data you already have. | none new | Small to medium |
| 3 | **Study timer** (Pomodoro, 25/5) | Works fully in the browser; optionally saves sessions per course to show "hours studied this week". | `StudySession { id, userId, courseId?, startedAt, minutes }` | Small |
| 4 | **Flashcards from notes** | Turn lines like `Q:: answer` in a note into cards; simple spaced repetition (review again in 1, 3, 7 days). | `Flashcard { id, userId, noteId?, front, back, dueAt, interval }` | Medium |
| 5 | **Class schedule** | Weekly timetable per course (day, time, room). The Courses list already exists. | `ClassMeeting { id, userId, courseId, weekday, startTime, endTime, room? }` | Small |
| 6 | **Grade / GPA calculator** | Client-only, nothing stored. **Needs the college's real grading scale first**; do not guess it. | none | Small once scale is known |
| 7 | **Note templates** (Cornell, lecture, study guide) | A "New note from template" menu; templates are just starter Markdown. | none | Small |
| 8 | **Reminders by email** ("due tomorrow") | Opt-in, off by default, one email per item per day at most. Needs the existing checker and email. | `Notification` type + preference | Medium |

## Rules every new tool follows
1. A `userId` column and a `userId` filter on EVERY query; ownership checked on every update and delete.
2. Size limits and a per-student cap, because everyone shares one free database.
3. Deleted with the account (`onDelete: Cascade`) and mentioned on the privacy page.
4. A test in `scripts/dev/e2e.mjs` that proves another student cannot read, edit or delete it.
5. New data = a new migration folder; the owner runs `npm run db:deploy` after deploying.
