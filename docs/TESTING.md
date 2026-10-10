# Testing

## What the automated test covers

`scripts/dev/e2e.mjs` runs the whole flow against a **pretend e-GURO** (`scripts/dev/mock-lms.mjs`) and a **local fake mail server**. It makes 149 checks: registration, login rules, connecting e-GURO, the silent first check, new item -> notification -> email, no duplicate emails, notification preferences, two students never seeing each other's data, mark as read, e-GURO being down, e-GURO changing its format, a changed e-GURO password (only one login attempt), reconnecting, changing the app password, logout.

**Important:** the pretend e-GURO copies the request and response shapes seen in the diagnostic reports (login, `course_filter.php` with the `global_class` list, `table_course.php` with pages). Passing these tests does NOT prove the real e-GURO works. That needs your own account (see `MANUAL_STEPS.md`, section B). The mock is a development test fixture only; it is not used when the app runs normally.

## Run it yourself

You need a Postgres database you can throw away (a local one, or a second free Neon database). **Never point this at your real database.** Do not use your real e-GURO account; the test uses fake accounts on the pretend server.

```bash
# 1. a test .env (use a throwaway database URL)
export DATABASE_URL="postgresql://USER:PASS@HOST:5432/egaro_test"
export AUTH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export ENCRYPTION_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export CRON_SECRET="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
export LMS_BASE_URL="http://localhost:4000"
export INVITE_CODE="class-2026"          # the test signs up with this code
export APP_URL="http://localhost:3010"     # confirm and reset links point here
export SMTP_HOST=localhost SMTP_PORT=2525 SMTP_SECURE=false MAIL_FROM="e-GURO Companion <test@example.com>"
export DELAY_BETWEEN_USERS_MS=0

# 2. create the tables, build and start the app on port 3010
npm run db:deploy
npm run build
PORT=3010 npm run start &

# 3. run the test (takes a few minutes: it makes real timed checks)
APP_URL=http://localhost:3010 node scripts/dev/e2e.mjs
```

Expected last line: `Result: 149 passed, 0 failed`.

The parsers have their own 27 checks: `npm run test:parsers`.

## Manual checks still needed in a browser

Open each page on desktop and phone: Overview, Courses, Activities (try every filter), Notifications, Settings. Try dark mode, keyboard-only navigation (Tab), and the empty states (a brand-new account).

### Onboarding checklist (new)

On a brand-new account the Overview page shows a three-step checklist (Confirm email, Connect e-GURO, Check now). Check it by hand: after signing up it should show "0 of 3 done"; after confirming the email "1 of 3"; after connecting "2 of 3"; after the first successful check the card disappears completely and never comes back.

### Owner alerts (new)

Set `OWNER_ALERT_EMAIL` and run the checker against a test database with `OWNER_ALERT_FAILURE_THRESHOLD=2`. Fail two checks in one run (`npm run check`, or point `LMS_BASE_URL` at a dead address): the alert should arrive with the failure codes but **no** student address, password or token. Delete the `owner_alert_checker_at` row in `system_state` (or wait `OWNER_ALERT_COOLDOWN_MINUTES`) before testing the second alert.

For the layout alert, set `OWNER_ALERT_FORMAT_THRESHOLD=1` and make the pretend e-GURO answer `table_course.php` with HTML instead of JSON: the alert should say the layout is unrecognised and point at `npm run lms:diagnose`.

To test without a database, `scripts/dev/email-preview.ts` renders every email, including the owner alerts.

## More tests (development only, use a test database)

- `npm run check:ownership`: fails if a database call on student data forgets the `userId` filter.
- `npm run check:secrets`: fails if a key, password or `.env` file is committed.
- Scale: `npx tsx scripts/dev/scale-test.ts 100` creates 100 pretend students and runs the real checker (needs `LMS_BASE_URL=http://localhost:4400`, `MAX_USERS_PER_RUN=100`, `DELAY_BETWEEN_USERS_MS=0`). Result here: all 100 checked in 65 seconds, no failures, no duplicates.
- Speed: `node scripts/dev/speed-test.mjs` times every page with 300 items and 120 notes. Result here: every page under 0.25 s at p95.
- Backup drill: `npm run backup`, create an empty database, `npm run db:deploy`, `npm run restore -- backups/FILE.enc`, then compare. Result here: all 7 tables identical.
