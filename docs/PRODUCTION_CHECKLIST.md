# From "works on my laptop" to "ready for real users"

This follows the five areas of the "Vibe coding vs. production reality" picture. **Done** = built and tested here. **Your step** = needs your accounts. **Not done** = left out on purpose, with the reason.

## 1. Security
| Item | Status |
|---|---|
| Auth and permissions | **Done.** Hashed passwords, signed cookie sessions, per-student data filters, email confirmation, password reset, invite code. 149 automated checks prove one student cannot read, edit or delete another's data. |
| "Security and RLS" (row level security in the database) | **Not done, on purpose.** RLS matters when browsers talk to the database directly (as with Supabase). Here only the server does, and every query is filtered by `userId`. Instead of RLS I added `npm run check:ownership`: it fails the build if any database call on student data forgets the `userId` filter, and I tightened the system jobs to filter by owner too. Neon's default database role bypasses RLS, so real RLS would need a second restricted role and a wrapper around every query. If you ever want it: plan it as a separate project. |
| Rate limiting | **Done.** Now stored in the database, so it works across all server instances (the old in-memory version did not). Sign-up, login (per IP and per account), reset links, e-GURO connect, test email, notes, delete account. Tested. |
| Secrets | **Done.** `npm run check:secrets` fails the build if a key, password or `.env` is committed. |
| Headers and caching of private data | **Done.** HTTPS-only, clickjacking and content-type protection, a content policy, and `Cache-Control: no-store` on every private page and API route (tested). |
| Dependencies | **Done.** CI runs `npm audit`; Dependabot proposes updates weekly. |

## 2. Shipping
| Item | Status |
|---|---|
| Hosting and deployment | **Done** (Vercel). **Your step:** nothing new. |
| Cloud and compute | **Your step:** put the Vercel region near your database. If your Neon database is in Singapore, set the function region to Singapore (Vercel project > Settings > Functions). A database far from the functions makes every page slower. |
| CI/CD | **Done.** `.github/workflows/ci.yml` runs on every push and pull request: secret check, ownership check, types, parser tests, build, and the full end-to-end test on a real Postgres. **Your step:** GitHub > Settings > Branches > add a rule for `main`: "Require status checks to pass" (select CI). Then a broken change cannot be merged. |
| Database migrations | **Done.** A production deploy now applies new migrations itself (`vercel-build`), and a failed migration stops the deploy so the old version stays live. You no longer run `npm run db:deploy` by hand. **Your step:** add `DIRECT_URL` in Vercel (Neon's non-pooled address) so migrations use a direct connection. |
| Version control | **Your step:** work on a branch, open a pull request, merge when CI is green. Vercel makes a preview site for each pull request. Roll back with Vercel > Deployments > an older deployment > Instant Rollback (database changes are not rolled back, which is why migrations only add things). |

## 3. Speed
| Item | Status |
|---|---|
| Caching and CDN | **Done / explained.** Vercel's CDN already caches the built files (scripts, styles, fonts). Pages with someone's data are deliberately never cached. The Markdown preview library loads only when someone opens Preview. |
| Measured | `npm run` speed test, 300 items and 120 notes for one student: every page under 0.25 s at p95 on a laptop with the database on the same machine. Online, add the distance to your database (see Cloud and compute). |

## 4. Traffic
| Item | Status |
|---|---|
| Load balancing and scaling | **Handled by Vercel** (it runs more copies when busy). The limits are elsewhere: |
| Database connections | **Done.** Each server copy uses at most 3 connections (`DB_POOL_MAX`). **Your step:** use Neon's POOLED address as `DATABASE_URL` (the host contains `-pooler`). |
| The checker | **Measured.** 100 pretend students were all checked in 65 seconds, 3 at a time, with no failures and no double saves (`scripts/dev/scale-test.ts`). One run can stop after 240 s, so a single run handles several hundred students. Each student is still only checked every 15 minutes. |
| e-GURO itself | The real limit. All checks come from one server address; keep `CHECK_CONCURRENCY` at 3 or less and the interval at 15 minutes or more. |

## 5. Survival
| Item | Status |
|---|---|
| Error tracking and logs | **Done.** Unexpected errors and e-GURO failures are written to the database (scrubbed of emails, tokens, passwords and database addresses), because Vercel Hobby only keeps logs for about an hour. See them in `/api/admin/summary`. Friendly error pages for crashes and unknown addresses. **Not done:** a paid tracker such as Sentry; add it only if you outgrow this. |
| Availability monitoring | **Done in code, your step to turn on.** `/api/health?strict=1` fails if the database is down, a setting is missing, or the checker has not run for 30 minutes. Make a free UptimeRobot account, add an HTTP monitor on that address every 5 minutes, and it emails you. |
| Owner alerts | **Done in code, your step to turn on.** Set `OWNER_ALERT_EMAIL` and the checker emails you when one run has at least `OWNER_ALERT_FAILURE_THRESHOLD` failed checks (default 3), and separately when e-GURO answers in a layout the parsers no longer recognise (`OWNER_ALERT_FORMAT_THRESHOLD`, default 1). Sent through the same Gmail account, with every detail scrubbed: no student addresses, passwords or tokens. One alert per kind per `OWNER_ALERT_COOLDOWN_MINUTES` (default 60), so a site that stays broken cannot flood the inbox. |
| Backups and recovery | **Done.** `npm run backup` makes one encrypted file; `npm run restore` rebuilds an empty database from it. The drill was run: all 7 tables came back identical, wrong keys and non-empty databases are refused. Also check what restore window your Neon plan gives. An optional weekly `backup.yml` workflow exists. **Your step:** run a backup now and keep the file and `ENCRYPTION_KEY` in two different places. |
| Graceful failure | **Done.** e-GURO down = automatic back-off and retry; wrong e-GURO password = stop after one attempt; failed emails retry 3 times; a stopped checker is detected by the heartbeat. |

## What I did NOT do or test
- No real traffic, only the pretend e-GURO and a local database.
- The GitHub workflows (CI, backup) are checked for valid syntax but have not run on GitHub yet.
- UptimeRobot, Vercel regions and branch protection are your settings.
