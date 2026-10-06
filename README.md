# e-GURO Companion

> Your LMS, without the constant checking.

A free, multi-user web app that watches a student's own e-GURO account (City College of Calamba LMS) and emails them when something new appears.

**Read `MANUAL_STEPS.md` first.** It lists everything you must do yourself, in order.

## Honest status

| Part | Status |
|---|---|
| Accounts, login, logout, sessions | Built and tested |
| Database (6 tables), per-user isolation | Built and tested |
| Duplicate-proof detection, first-check baseline | Built and tested (against a pretend e-GURO) |
| Email notifications, per-type preferences | Built and tested (against a local fake mail server) |
| Scheduled checker, per-student failure handling | Built and tested |
| Dashboard, Courses, Activities, Notifications, Settings pages | Built; page content checked by tests; **not viewed in a real browser** |
| **Real e-GURO login** | **Works** (confirmed on a real account) |
| **Real e-GURO activity data** | **NOT working yet.** Reading the activity list fails; run `npm run lms:diagnose` and send the report (see `MANUAL_STEPS.md`, section B) |
| Courses list, announcements, item links | Not available until the real e-GURO responses are captured |
| Production deployment (Vercel / Neon / GitHub Actions) | Documented, **not tested** |

## Features

- Register, log in, log out; passwords hashed with bcrypt
- Connect your own e-GURO account (password stored encrypted with AES-256-GCM)
- Checks about every 15 minutes; the first check is silent, later checks email only genuinely new items
- Never emails the same item twice (unique key per student plus item)
- Per-type email switches (activities, quizzes, assignments, announcements); daily summary is off and not built
- If your e-GURO password changes, checking stops after one rejected login and you are asked to reconnect
- Pages: Overview, Courses, Activities (filters), Notifications (read / mark all read), Settings
- Light and dark mode, mobile layout, keyboard friendly

## Tech stack (all free tiers)

Next.js (App Router) and TypeScript, PostgreSQL (Neon) with Prisma 7, Nodemailer with Gmail SMTP, GitHub Actions as the scheduler, Vercel Hobby for hosting.

## Project structure

```
app/            pages and API routes ((app)/ = signed-in pages, api/ = endpoints)
components/     UI pieces
lib/            database client, auth, encryption, config, small helpers
services/
  lms/          ALL e-GURO code (client.ts = network, parsers.ts = data shaping)
  notifications/ new-item detection, fingerprints, preferences
  email/        templates, SMTP transport, sending
  checker/      one-student sync and the scheduled run
prisma/         schema.prisma and migrations
scripts/dev/    mock e-GURO and end-to-end test (development only)
docs/           old prototype audit, progress log, security review, testing, deployment
.github/workflows/check.yml   the free scheduler
```

## Requirements

Node.js 20 or newer, a PostgreSQL database (free Neon), a Gmail account for sending.

## Install and run locally

```bash
npm install                # also runs "prisma generate"
cp .env.example .env       # then fill in the values (see MANUAL_STEPS.md)
npm run db:deploy          # creates the tables
npm run dev                # http://localhost:3000
```

Design: Instrument Serif, Geist and Geist Mono (bundled, nothing loads from outside), light and dark theme with a toggle. See `DESIGN.md`.

Pages: `/register`, `/login`, `/dashboard`, `/courses`, `/activities`, `/notifications`, `/settings`, `/status` (health check), `/api/health` (JSON).

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `LMS_BASE_URL`, `SMTP_*`, `MAIL_FROM`, `CRON_SECRET`.

## How the LMS connection works

`services/lms` logs in the way a browser does (loads the login page, reads its hidden fields, posts your username and password, keeps the cookies) and then reads the activity lists as JSON. It tries **one** login per check and never retries a rejected password. Everything specific to e-GURO is in `client.ts` and `parsers.ts`, so a change on the college's side means editing only those files.

## How notifications work

1. A check reads your items and builds a stable key for each (`lms:<type>:<id>`).
2. Keys already saved are ignored; the database also enforces uniqueness per student.
3. First check for an account: save everything silently.
4. Later checks: each new item gets a notification and, if that type is switched on, one email (`PENDING` then `SENT`). Failed emails retry up to 3 times.

## How scheduled checking works

GitHub Actions calls `POST /api/cron/check` with `CRON_SECRET` about every 15 minutes. The checker picks the students who are due (oldest first, up to `MAX_USERS_PER_RUN`), checks each in its own try/catch, and updates their status. Temporary errors back off (up to 6 hours); a rejected login stops checking for that student until they reconnect.

## Testing

See `docs/TESTING.md`. In short: `scripts/dev/e2e.mjs` runs 56 checks against a pretend e-GURO.

## Deployment

See `docs/DEPLOYMENT.md`.

## Troubleshooting

- **`prisma generate` fails during install:** it downloads engine files; check your connection or proxy.
- **/status shows database ERROR:** check `DATABASE_URL`, the `?sslmode=require` part, and that Neon is not paused.
- **Check now says e-GURO responded in a way it does not understand:** the activity list address or format differs from the old prototype; run `npm run lms:diagnose` and follow `MANUAL_STEPS.md` section B.
- **"Needs to be updated" on the dashboard:** e-GURO rejected the saved password; reconnect in Settings.
- **No emails:** check `SMTP_*` and `MAIL_FROM`, and that the Gmail app password is correct. Emails stay `PENDING` while email is not configured.
- **Everyone must reconnect suddenly:** `ENCRYPTION_KEY` changed.

## Security notes

See `docs/SECURITY_REVIEW.md` for what was checked and the known limitations.
