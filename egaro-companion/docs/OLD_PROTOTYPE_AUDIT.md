# Old Prototype Audit — ifwian/LMSNotifier

**Milestone 0 · Date: 2026-10-02**
**Scope:** Read-only inspection. The old repository was NOT modified. No credentials are included in this document.

---

## 0. Audit coverage (read this first)

| Item | Status |
|---|---|
| `scraper.py` (234 lines) | Read in full |
| Repo root listing (`.github/workflows`, `notifier/`, `requirements.txt`, `scraper.py`, `state.json`) | Read |
| Live e-GURO login page (`https://lms.ccc.edu.ph/`) | Fetched (public page only, not logged in) |
| `.github/workflows/check.yml` | Read (pasted by the owner, secrets are only referenced by name) |
| `requirements.txt` | Read (pasted by the owner): `requests`, `beautifulsoup4` |
| `state.json` | Read (pasted by the owner): contents are `{}` |
| `notifier/` folder | Not browsed directly. The workflow runs `python scraper.py` from inside `notifier/`, so a copy of the scraper lives there; it is assumed to match the root `scraper.py` (unverified) |
| Logged-in e-GURO behavior | **Not verified** — requires the owner's own login |

The only remaining gap is the `notifier/scraper.py` copy. If it differs from the root `scraper.py`, tell me.

---

## 1. What the old project does

A single-file Python script (`scraper.py`) designed to run on a schedule in GitHub Actions for **one** student (the owner):

1. Reads `LMS_USERNAME` / `LMS_PASSWORD` from environment variables (GitHub Secrets).
2. Logs into `https://lms.ccc.edu.ph/` using `requests` + `BeautifulSoup`.
3. Calls an internal AJAX endpoint repeatedly to collect "pending" items.
4. Compares the result with a local `state.json` file.
5. Sends a Gmail SMTP email if something is new or urgent.
6. Saves the new state to `state.json`.

### 1.1 Authentication approach

- `GET /` to load the login page and read a hidden CSRF-style field named `token_login_form`.
- `POST /app/login.php?formSubmitted=true` with form fields: `username`, `password`, `submit=login`, `token_login_form`, and an `agents` field (a JSON blob describing a browser: name, version, layout engine, OS).
- Standard browser-like headers (`Origin`, `Referer`, a Chrome `User-Agent`).
- A `requests.Session` keeps the cookies for later calls.
- **Login success check:** if the response still contains an `<input name="password">`, it assumes login failed.

### 1.2 LMS access approach

Plain HTTP requests (no browser automation). After login:

- `GET /app/course_filter.php?filter_text=<F>&type_text=<T>` with `X-Requested-With: XMLHttpRequest`, expecting JSON shaped like `{"data": [...]}`.
- It loops over **4 filters** (`ASSIGNED`, `DUE_TODAY`, `MISSED`, `UNREAD`) × **7 types** (`LESSON`, `ACTIVITY_QUIZ`, `ASSESSMENT`, `QUESTIONNAIRE`, `SUBMIT_ANSWER`, `FILE_LESSON`, `LINK`) = **28 requests per run**.
- Fields it reads from each item: `class_exam_id` (used as the identifier), `title`, `mark_type`, `from_date`, `to_date`.
- It also references `/app/main_student.php` (used as a `Referer`).

### 1.3 Detection approach

- Items are stored in a dict keyed by `class_exam_id`, with the set of filters each item appeared under.
- "New" = ID not in the previous `state.json`.
- "Urgent" = item currently in `DUE_TODAY` or `MISSED`.

### 1.4 Email approach

- Gmail SMTP over SSL (`smtp.gmail.com:465`) with an app password (`GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, optional `NOTIFY_EMAIL`).
- One plain-text email listing new items and "still needs attention" items.

### 1.5 Automation approach

- GitHub Actions workflow named "Check LMS".
- Trigger: cron `0 23 * * *` (23:00 UTC = 7:00 AM Philippine time), so **once per day**, plus manual `workflow_dispatch`.
- Steps: checkout → Python 3.11 → `pip install -r requirements.txt` → `python scraper.py` (from the `notifier/` folder) with five secrets (`LMS_USERNAME`, `LMS_PASSWORD`, `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, `NOTIFY_EMAIL`) → commit `notifier/state.json` back to the repo as `github-actions[bot]` and push.
- The job has `contents: write` permission so it can push the state commit.

---

## 2. Likely reasons it stopped working

Ordered from most to least likely. None of these can be fully confirmed without a logged-in test or the Actions run logs.

1. **Changed password (confirmed by you).** The stored `LMS_PASSWORD` secret is now wrong. The script would hit its "Authentication failed" branch.
2. **Possible repeated failed logins.** The e-GURO login page shows a **"Login Attempts"** counter. A scheduled job retrying with a stale password could have increased this counter. If a lockout exists, the account may need to be unlocked or reset. *(Whether the counter enforces a lockout is unverified.)*
3. **GitHub Actions IPs may be blocked or challenged.** The script itself contains a message suggesting this was already suspected during development. Shared cloud IPs are commonly filtered.
4. **Login form or endpoint changes.** `token_login_form`, the `agents` field, `login.php`, and `course_filter.php` are all details of the page as it was when the script was written. Any change breaks the script. *(Not verified — they sit behind login. The public login page was reachable and showed a sign-in form, but hidden fields were not visible in the fetched text.)*
5. **Weak failure detection.** "Password input still present" is a fragile heuristic. A CAPTCHA page, maintenance page, or lockout page could be misreported as "bad password" (or the reverse).
6. **State file is empty (`{}`).** The commit step only runs after the checker step succeeds. An empty state is consistent with the script having failed at login every time (so state was never written), or with it never having completed a run. This is an inference, not proof; the Actions run history would confirm it.
7. **Once-a-day schedule.** Even when working, this design only checked once per day, so it could never notify "when something new appears".

---

## 3. What can be reused conceptually

- **The integration method is plain HTTP, not a browser.** Fetch login page → read hidden token → POST credentials → reuse the session cookie. This is simple enough to run inside a serverless function.
- **The data source:** an AJAX endpoint that returns JSON for pending items. JSON is much safer to parse than HTML. *(Must be re-verified from your own logged-in browser in Milestone 4.)*
- **A stable identifier exists:** `class_exam_id`. This is the right basis for duplicate prevention.
- **Useful field names to look for:** `title`, `mark_type`, `from_date`, `to_date`.
- **Diff logic:** "ID not seen before = new" is correct and simple.
- **Clear error messages** for "can't reach LMS", "token missing", and "auth failed". Keep these as distinct error categories.
- **Browser-style headers and a cookie session.**

---

## 4. What should NOT be reused

| Old practice | Problem | New approach |
|---|---|---|
| One global `LMS_USERNAME` / `LMS_PASSWORD` | Single-user only | Per-user connection; credentials encrypted per user |
| Credentials in GitHub Secrets | Cannot support multiple students | Encrypted in the database, key in an env variable |
| `state.json` stored in the repo | Activity titles become public if the repo is public; no per-user separation; races between runs | Database tables scoped by `user_id` |
| No `user_id` anywhere | Cannot isolate users | Every table has a `user_id` foreign key |
| Emailing "urgent" items **every run** | Violates the no-duplicate rule — a due-today item would be emailed every cycle | Email only when a new notification row is created; track `email_sent` |
| First run with empty state emails everything | Notification flood | On first sync for a user, save items silently (baseline) and only notify for later arrivals |
| 28 requests per run per user | Heavy load on a college server, multiplied by every student | Fewer requests; check what the dashboard actually needs; add delays; respect a configurable interval |
| Fake browser fingerprint (`agents` JSON claiming Chrome 122 on Windows 10) | The site's form expects this field, but impersonating a browser is brittle and not transparent | Send what the form needs, but use an honest `User-Agent` that identifies the app (e.g. `eGuroCompanion/1.0`) and keep this in one isolated module |
| Retrying with bad credentials | Can trigger lockouts | Stop after the first auth failure and mark the connection "needs attention" |
| Debug prints of response URL and a response body preview | Could leak session or personal data into logs | Never log response bodies, cookies, or credentials |
| Gmail SMTP with an app password from a personal mailbox | Personal account as sender; app password stored in repo secrets | Still Gmail SMTP (it is the free option), but from a dedicated project Gmail account, with the app password only in server env variables |
| Only "pending" filters | Completed items vanish; no announcements; no course info | Collect course and announcement data as the real site allows (verify in Milestone 4) |
| Single Python file | Hard to test or extend | Separate modules (below) |

---

## 5. Current e-GURO integration findings

Verified:

- The login page at `https://lms.ccc.edu.ph/` is reachable over HTTPS and shows a "SIGN-IN" form with a **"Login Attempts: 0"** indicator and a "Forgot Password / Reset Password" link.
- A public FAQ page exists at `/faq.php`.

Not verified (do not assume):

- Whether `login.php`, `token_login_form`, `agents`, `course_filter.php`, or `main_student.php` still behave as the old script expects.
- Whether a lockout or CAPTCHA exists.
- Whether any announcements/courses endpoint exists, and what it returns.
- No documented public API was found. **The new app must not assume one exists.**

**Required before Milestone 4:** capture the real current flow from your own logged-in browser (DevTools → Network tab → export HAR or copy the request list), with passwords and cookies removed. That tells us the actual endpoints instead of guessing.

---

## 6. Deployment finding that affects the architecture

The brief prefers Vercel plus a scheduled function checking every 10–15 minutes. According to Vercel's cron documentation, **the Hobby (free) plan only allows cron jobs that run once per day**, and the run may fire anywhere within the scheduled hour; Pro allows per-minute schedules. Limits can change, so re-check before deploying.

Options:

1. **Vercel Pro** — native cron at 10–15 min.
2. **Vercel Hobby + external scheduler** — a free scheduled GitHub Actions workflow (or similar service) simply calls a secured `/api/cron/check` endpoint. The LMS requests would still originate from Vercel, not from GitHub's IPs.
3. **Vercel Hobby, daily cron only** — works but defeats the "notify when new" goal.

**Update — project must be free.** Decision: use option 2. Vercel Hobby (free) hosts the app; a scheduled GitHub Actions workflow calls the secured endpoint. GitHub's scheduler runs at a minimum 5-minute interval but can be delayed, so plan for roughly 15-minute checks with some drift (verify during Milestone 11). A public repo gets free Actions minutes; the call takes seconds. Also note: scheduled workflows in a repo with no activity may be paused by GitHub after a period; check GitHub's current rule.

Recommendation: build the checker as a secured API route (protected by a `CRON_SECRET`), then choose the trigger at deployment time. The route itself does not change.

---

## 7. Proposed new architecture

**Principle:** one understandable project, no extra infrastructure.

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) with TypeScript | One codebase for UI + API routes; first-class Vercel support |
| Database | PostgreSQL on a free tier (Neon or Supabase; pick in Milestone 1 and confirm current limits) | Relational, serverless-friendly, free |
| DB access | **Prisma** (your choice) | Typed queries and migrations; readable schema file |
| Auth | Email + password, hashed (argon2 or bcrypt), signed HTTP-only session cookie with expiry | Matches the brief; no third-party login needed |
| Secrets | Environment variables only | `.env.local` ignored by Git |
| LMS credentials | Encrypted with AES-256-GCM using a server-side key (`ENCRYPTION_KEY`) | The checker has to log in repeatedly while the student is offline, so the credentials must be recoverable by the server; never stored in plaintext |
| Email | Gmail SMTP via Nodemailer, using a dedicated project Gmail account and an app password (free) | Resend's free plan only delivers to your own account email unless you verify a domain you own (paid). Gmail SMTP can email any student. Gmail has a daily sending cap; keep emails short and per-event |
| Scheduling | Secured route `/api/cron/check` (`CRON_SECRET`) triggered by a GitHub Actions schedule | Free; see section 6 |
| Hosting | Vercel Hobby | Free for personal, non-commercial use |
| Styling | Plain CSS with design tokens from the FRAME `DESIGN.md` | Keeps it simple; fits the monochrome direction |

### Folder layout

```
/app            pages and API routes (UI + endpoints)
/components     reusable UI pieces
/lib            small helpers (auth, crypto, validation, config)
/services
  /lms          ALL e-GURO logic lives here (login, courses, activities)
  /notifications  detection + notification creation
  /email        Nodemailer (Gmail SMTP) wrapper and templates
/database       schema + migrations
/scripts        dev utilities
/docs           audit, progress log
```

### LMS service boundary (Milestone 4)

```
lms/
  client.ts       login + session handling (only place that makes HTTP calls)
  parsers.ts      turns LMS responses into our own types
  types.ts        LmsCourse, LmsActivity
  errors.ts       AuthError | TemporaryError | ParseError
```

Everything else in the app talks to these functions only, so if e-GURO changes (or browser automation is ever needed) only this folder changes.

### Detection and duplicate rules

- Unique key: `(user_id, lms_activity_id)`; fallback `(user_id, fingerprint)` where fingerprint = hash of normalized course + type + title + due date.
- First sync for a user = baseline: save, **do not email**.
- A notification row is created only when an activity row is inserted for the first time. Email is sent only for notification rows where `email_sent = false`, and the flag is set after a successful send.

### Checker behavior

- Per-user `try/catch`; one failure never stops the run.
- Auth failure → status `AUTH_ERROR`, stop retrying that user until they reconnect.
- Temporary failure → status `TEMPORARY_ERROR`, back off.
- Small delay between users to avoid load spikes.
- Configurable interval and per-run user limit.

---

## 8. Security problems to avoid (summary)

1. Shared credentials in GitHub Secrets for a multi-user app.
2. Activity data (`state.json`) committed to a repository.
3. No user scoping on data.
4. Repeated retries with failing credentials.
5. Debug output of response content.
6. Emailing the same item every run.
7. Hard-coded recipient addresses.
8. Missing authorization checks on API routes (every route must check login **and** ownership).

---

## 9. Open questions for the next step

1. Confirm the free-stack plan: Vercel Hobby + free Postgres + Prisma + Gmail SMTP + GitHub Actions scheduler.
2. Is the `notifier/scraper.py` copy identical to the root one?
3. Before any new login testing: check your own e-GURO "Login Attempts" status, then rotate any password that was ever stored in the old GitHub Secrets.
4. For Milestone 4: a sanitized DevTools Network capture of your own logged-in e-GURO session.
