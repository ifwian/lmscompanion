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
