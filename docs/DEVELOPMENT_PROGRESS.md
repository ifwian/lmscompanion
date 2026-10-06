# Development Progress

Legend: **Verified** = tested in the build environment. **Unverified** = written but needs your own test (see `MANUAL_STEPS.md`).

## Milestone 0 — Project audit — completed
- **Date:** 2026-10-02
- **Built:** Audit of the old Python prototype (ifwian/LMSNotifier). See `docs/OLD_PROTOTYPE_AUDIT.md`.
- **Files changed:** `docs/OLD_PROTOTYPE_AUDIT.md`
- **Tested:** Read `scraper.py`, the workflow, `requirements.txt`, `state.json`; fetched the public e-GURO login page.
- **Result:** Completed. Likely failure reasons identified (changed password, once-a-day schedule, possible lockout or IP blocking, possible site changes).
- **Notes:** GitHub blocked automated folder views; the missing files were pasted by the owner. Logged-in e-GURO behavior could not be checked.

## Milestone 1 — Project foundation — completed
- **Date:** 2026-10-03
- **Built:** Next.js + TypeScript project, folders, base styles, `.gitignore`, `.env.example`, README, Prisma 7 with Postgres adapter, `/status` page and `/api/health`.
- **Files changed:** `package.json`, `tsconfig.json`, `next.config.ts`, `prisma/*`, `lib/db.ts`, `lib/health.ts`, `app/*`
- **Tested:** type check, production build, health endpoints with no / unreachable database (no secret leaked in output).
- **Result:** Completed.
- **Notes:** The sandbox cannot download Prisma's migration engine, so migrations were applied with `psql`; `npm run db:deploy` on your machine is the first real run of that command.

## Milestone 2 — Authentication — completed
- **Date:** 2026-10-03
- **Built:** Register, login, logout, bcrypt, signed HttpOnly session cookie (7 days), protected pages (proxy + server check), same-origin check, rate limiting.
- **Files changed:** `lib/auth/*`, `app/api/auth/*`, `app/login`, `app/register`, `proxy.ts`, `components/AuthForm.tsx`
- **Tested:** valid/duplicate/short-password register, cross-site request, wrong password vs unknown email, forged cookie, logout, rate limit (curl against a real local Postgres).
- **Result:** Completed.

## Milestone 3 — Database — completed
- **Date:** 2026-10-03
- **Built:** All six tables (`users`, `lms_connections`, `courses`, `activities`, `notifications`, `notification_preferences`), enums, indexes, unique constraints, migrations.
- **Files changed:** `prisma/schema.prisma`, `prisma/migrations/*`
- **Tested:** migrations applied from an empty database; used by every later test (creates, reads, updates, unique constraints, per-user isolation).
- **Result:** Completed.
- **Notes:** `notifications` uses an `email_status` field (PENDING/SENT/SKIPPED/FAILED) instead of a simple `email_sent` yes/no, so "turned off by the student" can be shown honestly. Duplicate key is `activities(user_id, fingerprint)`.

## Milestone 4 — LMS integration — built, UNVERIFIED against real e-GURO
- **Date:** 2026-10-03
- **Built:** `services/lms` (client, parsers, errors). Functions: `connect` (login once), `getActivities`, `getCourses` and `getAnnouncements` (return nothing: no verified source yet).
- **Files changed:** `services/lms/*`, `lib/crypto.ts`, `lib/config.ts`
- **Tested:** against the pretend e-GURO only: login success and failure, expired session, server down, changed response format.
- **Result:** Built, **not verified with a real account**. This is the main open risk.
- **Notes:** I could not log in to e-GURO. Endpoint names, the `agents` field value and the type mapping are assumptions from the old prototype. No fake data is used by the app itself.

## Milestone 5 — LMS connection UI — completed (browser view unverified)
- **Date:** 2026-10-03
- **Built:** Connect/reconnect form, connection panel with status and last checked/login, disconnect, "Check now".
- **Files changed:** `components/LmsConnectForm.tsx`, `components/ConnectionPanel.tsx`, `app/api/lms/*`
- **Tested:** wrong credentials (nothing saved), correct credentials (stored encrypted), temporary failure, changed password (AUTH_ERROR and prompt to reconnect).
- **Result:** Completed.

## Milestone 6 — Activity detection — completed
- **Date:** 2026-10-03
- **Built:** `services/notifications/detect.ts`, fingerprints, first-check baseline.
- **Tested:** first check saves silently; repeated checks add nothing; an item whose title is edited (same id) is not new.
- **Result:** Completed (against the pretend e-GURO).
- **Notes:** Course sync is not possible yet (no verified course source); items are saved without a course.

## Milestone 7 — Email notifications — completed
- **Date:** 2026-10-03
- **Built:** Nodemailer SMTP transport, plain email template (HTML-escaped), per-type preferences, status tracking and retries (max 3).
- **Files changed:** `services/email/*`, `services/notifications/preferences.ts`
- **Tested:** real SMTP conversation with a local fake mail server: correct recipient and subject, one email per item, none repeated, turned-off type is saved but not emailed.
- **Result:** Completed. **Not tested with real Gmail.**

## Milestone 8 — Dashboard — completed (browser view unverified)
- **Built:** Overview, Courses, Activities (filters), sidebar/top-bar navigation, empty states, FRAME-style monochrome design with responsive layouts.
- **Files changed:** `app/(app)/*`, `components/*`, `app/globals.css`
- **Tested:** page content for each student, empty states, other student's data absent. Not looked at in a real browser (none available).
- **Result:** Built; needs your visual check.

## Milestone 9 — Notification center — completed
- **Built:** list with email status, mark as read, mark all as read.
- **Tested:** read state persists; one student cannot mark another's notification (404).
- **Result:** Completed.

## Milestone 10 — Settings — completed
- **Built:** account info, LMS connection, notification switches (saved immediately), change password (signs out other devices), log out. The LMS password is never shown.
- **Tested:** switches respected by the checker; password change invalidates the old session.
- **Result:** Completed.

## Milestone 11 — Automatic checker — completed
- **Built:** `services/checker/*`, `/api/cron/check` (secret required), `.github/workflows/check.yml`.
- **Tested:** several students in one run, one failing student does not affect the other, backoff, no retries after a rejected login (exactly one attempt), recovery.
- **Result:** Completed. The GitHub scheduler itself is untested.

## Milestone 12 — Security review — completed
- See `docs/SECURITY_REVIEW.md`. Added: security headers, session invalidation on password change, cron secret, ownership checks. Known limitations are listed there.

## Milestone 13 — UI polish — partially completed
- **Done:** typography, spacing, borders, dark mode, focus states, skip link, reduced motion, empty states, mobile layout rules.
- **Not done:** visual review in a real browser; loading skeletons (pages are server-rendered); the FRAME `DESIGN.md` was never provided, see `DESIGN.md`.

## Milestone 14 — Full test — completed against the pretend e-GURO
- **Tested:** `scripts/dev/e2e.mjs`, 56 checks, **56 passed, 0 failed**: register, login, connect, baseline, new item, notification, email, no duplicate, dashboard, two students never mixing, failures, password change, logout.
- **Not tested:** the real e-GURO, real Gmail, real Vercel/GitHub scheduler, a real browser.

## Milestone 15 — Production preparation — completed (untested online)
- **Built:** README, `.env.example`, `.gitignore`, migrations, `docs/DEPLOYMENT.md`, scheduler workflow, secret scan (no secrets found).

## Milestone 16 — Final delivery — completed
- Final zip created; contains no `node_modules`, `.env`, generated client or build output.
- **Your next steps:** `MANUAL_STEPS.md`.

## Update after the first real run — 2026-10-04
- **Real-world result:** the owner ran the app locally. `/status` showed the database connected, registration and login worked, and **connecting to the real e-GURO was accepted**. "Check now" then failed with "e-GURO responded in a way this app does not understand yet": the activity list request or its format differs from the old prototype.
- **Built:** `npm run lms:diagnose` (`scripts/diagnose-lms.ts`): logs in once, reads pages only, and writes a structure-only report (addresses, field names, types, sizes) for fixing `services/lms`. Password is typed hidden and never saved.
- **Fixed:** the page now refreshes after a failed check so the connection status is current; the panel explains the "format changed" state; forms use `method="post"` so a password can never end up in the address bar if JavaScript has not loaded.
- **Design refresh:** Instrument Serif / Geist / Geist Mono (bundled), numbered navigation, new landing and sign-in pages, light/dark toggle (cookie, no flash), refined lists, panels, switches and mobile layout.
- **Tested:** screenshots of every page in dark and light on desktop and in dark on a 390px phone, taken with a headless Chromium and reviewed; the 56-check end-to-end test was run again after the changes.

## Update 2 — 2026-10-04 (first real diagnostic report)
- **Finding:** login works; `/app/course_filter.php?...` returns a full HTML page (not JSON), so the old prototype's request no longer matches. The site's scripts mention `calendar_events.php`, `notif.php`, `main_student_class.php`, `grade_student_module.php`, `library.php`.
- **Built:** diagnostic v2 (`npm run lms:diagnose`): reads the home page, the `course_filter.php` page, `calendar_events.php` and `notif.php`, and reports link patterns, table column names, UI labels and the code that makes data calls, with long text masked.
- **Tested:** against a local pretend site; confirmed no titles, passwords, tokens or ids appear in the report.
- **Not done yet:** the e-GURO reading code (`services/lms`) is unchanged until the v2 report arrives.

## Update 3 — 2026-10-04 (second real diagnostic report)
- **Findings:** the activity list page (`course_filter.php`) is a Tabulator table with remote pagination that loads rows from a separate address (`base_url`, not yet seen) using parameters `filter_text` and `filter_type`. Row fields seen in the page code: `class_exam_id`, `teacher_class_id`, `title`, `from_date`, `mark_type`, `term`. Items open through `open_lesson.php` / `open_exam.php` / `lessons.php`. The calendar page loads events by POST `ajax_cal_event.php` (`action=VIEW`) and a notifications table lives at `/app/table/notif_table.php`. The old prototype used the wrong parameter name (`type_text`) and expected JSON from a page address.
- **Built:** diagnostic v3 follows those calls (finds `base_url`, reads the table the way the page does, shows field names, date formats and short value sets) with a locked-down read-only calendar request.
- **Tested:** against a pretend site; no titles, ids, tokens or passwords appear in the report.
- **Next:** rewrite `services/lms` from the v3 report.

## Update 4 — 2026-10-04 (e-GURO reading code rewritten from the real reports)
- **Findings used:** table rows come from `/app/table_course.php` (JSON `{last_page, total_record, data}`, params `filter_text`, `filter_type`, `page`, `size`); filters seen: ASSIGNED, DUE_TODAY, MISSED, UNREAD; type `ALL`; the filter page lists the student's classes in `var global_class = [...]` (teacher_class_id, subject_code, subject_text); item links follow `open_lesson.php` / `open_exam.php` with `id` (teacher_class_id), `param` (class_exam_id), `terms` (term), which matches the notification link format.
- **Changed:** `services/lms/client.ts` (new flow: filter page first, then 4 filters, paged, about 5 to 6 requests per check instead of 14), `services/lms/parsers.ts` (new row and class parsers), courses are now saved and linked to activities, activities keep the posted date (new column `posted_at`, migration `20261004000000_activity_posted_at`), activity lists are ordered by posted date.
- **Tested:** 17 parser checks and the end-to-end test (now 62 checks, 62 passed) including courses saved and linked, item links, EXAM shown as quiz, two-page lists (55 items), de-duplication across filters, and two students' courses never mixing.
- **Not tested:** against the real e-GURO with a non-empty list (the only real list reply seen so far was empty), real item links opening, announcements (not built).

## Update 5 — 2026-10-05 (pending item missing; email design)
- **Report:** the real e-GURO dashboard showed 1 pending item under "Assigned: Activity & Quiz", but the app listed nothing.
- **Cause found from the dashboard and reports:** the dashboard cards map "Activity & Quiz" to type LESSON and "Assessment" to type EXAM, and the page's own filter code uses fixed pairs. The app asked with type `ALL`, which has never been seen to work. The app now asks with exactly the dashboard pairs: ASSIGNED and DUE_TODAY for LESSON and EXAM, and MISSED for every type. UNREAD (unread lesson material, 19 items) is left out on purpose.
- **Changed:** EXAM is shown as "Assessment" (not "Quiz"); the email was redesigned (see `docs/EMAIL_PREVIEW.md`); optional `APP_URL` for the Settings link; new `npm run check` (one checker pass on your computer); diagnostic v4 probes each dashboard pair and "ALL" and shows the row fields.
- **Tested:** end-to-end test now 63 checks, 63 passed (includes the email's item link); email screenshots at desktop and phone width.
- **Not confirmed:** that the real server returns the pending item for ASSIGNED + LESSON (the only real list reply seen was an empty DUE_TODAY one), and the real row field names.

## Update 6 — 2026-10-05 (pending section, unread lessons, email test)
- **Report used:** diagnostic v4 shows `ASSIGNED` + `LESSON` returns the pending item with these row fields: class_exam_id, title, date_added, term, teacher_class_id, exam_type, submit_answer, date_deadline, from_date, to_date, review_date, grade, status, mark_type. The UNREAD list has no mark_type; its rows have submit_answer 0 (reading lessons). `last_page` and `total_record` are 0 even when rows exist.
- **Changed:** the app now keeps each item's CURRENT state (pending status, unread, material), refreshed on every check and cleared when an item is handed in or opened. Migration `20261005000000_activity_state`. New dashboard: four numbers, a prominent Pending activities section, a separate Unread lessons section. Activities page tabs: Pending / Unread / Read / All. Reading lessons never send email. Pagination also continues when a page is full, because last_page is unreliable.
- **Email:** new Send test email button (Settings) and `npm run email:test`; clear error messages (wrong login, unreachable server, sender mismatch); app passwords with spaces now work; stale unsent notifications (older than 3 days) are skipped; Settings shows whether email is set up on the server.
- **Reliability:** `/status` shows whether database updates were applied; a missing update now shows a clear message instead of a confusing connection error; "Check now" tells you what it found.
- **Scheduler:** the GitHub workflow now skips quietly until the app is deployed (no more failure emails).
- **Tested:** end-to-end 80 checks, 80 passed (includes pending/unread sections, lessons sending no email, new work sending exactly one email, handed-in items clearing, the test-email button); parser checks 25 passed; email command tested for success, wrong password, unreachable server, not configured, and an app password written with spaces; screenshots of dashboard (dark and light), unread view and phone layout.
- **Not confirmed on the real account:** which date the website shows as the due date; that the real item links open; real Gmail delivery.

## Update 7 — 2026-10-06 (from "one person's tool" to a site for classmates)
- **Request:** students should just open the site and sign up, with no GitHub, Neon or `.env`, and no per-student hosting.
- **Finding:** the app already was one multi-user site that stores each student's e-GURO password encrypted from the website form. The manual guide was the OWNER's one-time setup. So the work was making that safe and easy, not a redesign.
- **Built:** invite code; privacy page and consent; email confirmation (notifications only to confirmed addresses); forgot and reset password; delete my account; owner summary (counts only); checker runs a few students at a time and uses Vercel Hobby's 300 s limit; `npm run setup` wizard for the owner; migration `20261006000000_accounts_tokens`; docs `ARCHITECTURE.md`, `DEPLOY_ONCE.md`, `FOR_CLASSMATES.md`.
- **Corrected earlier advice:** GitHub's free plan gives private repositories only 2,000 Actions minutes a month, so a scheduler there needs a public repository or a free external scheduler.
- **Tested:** end-to-end test now 116 checks, 116 passed (adds invite code refusal, consent, confirmation links including old-link invalidation and single use, no email to unconfirmed addresses and delivery after confirming, forgot and reset flow, old sessions signed out, owner summary has no personal data, delete account removes everything, other students untouched); wizard run in a temporary folder.
- **Not tested:** real Vercel, Neon, Gmail, cron-job.org or GitHub scheduler; many real students at once; the wizard's database step (my environment cannot download Prisma's migration engine).
