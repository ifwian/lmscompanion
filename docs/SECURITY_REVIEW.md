# Security review (Milestone 12)

Date: 2026-10-03. This is a review of my own code plus the automated tests in `scripts/dev/e2e.mjs`. It is not an independent audit.

## Checked and OK

| Area | What was checked | Result |
|---|---|---|
| Passwords | bcrypt (cost 12); minimum 10 chars; max 72 bytes; hash never selected into pages | OK |
| Login | same error for unknown email and wrong password; dummy hash keeps timing similar | OK |
| Sessions | signed JWT in an HttpOnly, SameSite=Lax cookie, `Secure` in production, 7-day expiry | OK |
| Session invalidation | changing the password rejects all older sessions (tested) | OK |
| Authorization | every page and API route calls `getCurrentUser()` / `requireUserApi()`; every database query includes `userId` | OK |
| Ownership | another student's notification id returns 404 and is left unchanged (tested) | OK |
| LMS credentials | stored with AES-256-GCM; never selected into pages; never in logs or error messages (tested: password not on any page; no matches in the server log) | OK |
| CSRF | state-changing routes require a same-origin `Origin` header; cookie is SameSite=Lax (tested: cross-site request gets 403) | OK |
| XSS | React escapes output; email HTML escapes e-GURO text; no `dangerouslySetInnerHTML`; CSP header set | OK (CSP still allows inline scripts because Next.js needs them) |
| SQL injection | all queries go through Prisma (parameterized); no raw SQL with user input | OK |
| Cron endpoint | closed unless `CRON_SECRET` is set (16+ chars); constant-time comparison (tested: 401 without or with a wrong secret) | OK |
| Headers | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, HSTS in production | OK |
| Secrets | `.env*` ignored by Git; `.env.example` has placeholders only; final scan found no secrets | OK |
| Lockout protection | one rejected e-GURO login stops all automatic retries for that student (tested: exactly one attempt) | OK |

## Known limitations (not fixed)

1. **Stateless sessions:** logout only clears the browser cookie. A copied token works until it expires (7 days) or the password changes.
2. **Rate limiting is in memory per server instance.** On Vercel it is a best-effort brake only. A database-backed limiter would fix it.
3. **CSP allows `'unsafe-inline'` scripts** (required by Next.js without a nonce setup).
4. **The server can decrypt LMS passwords** (it must, to check on the student's behalf). Anyone with both the database and `ENCRYPTION_KEY` can read them. Keep the key only in Vercel and a private backup.
5. **No email verification** at registration. Someone could register with an email address they do not own and, after connecting their own e-GURO account, send their notifications to that address (an annoyance, not a data leak). Email verification is a good future addition.
6. **No password reset** ("forgot password") for the app yet.
7. **Browser testing:** the pages were screenshot-tested in a headless Chromium (desktop and phone sizes), not in every browser.

## Added after the first real run

- Forms use `method="post"` as a safety net (no password in the address bar if JavaScript fails).
- The theme choice is stored in a plain cookie that holds only `light` or `dark`; there is no inline script and no `dangerouslySetInnerHTML` anywhere.
- The diagnostic script hides page text by default and never prints the password or cookie values; its output file is ignored by Git.

## Added for a many-student site (October 2026)

| Area | What was done |
|---|---|
| Sign-up abuse | Optional invite code (compared in constant time), consent box required, per-IP limit raised so a shared campus connection is not blocked |
| Account takeover | Per-account login limit (10 per 15 minutes) in addition to the per-IP limit. Trade-off: someone could lock a victim out for 15 minutes by guessing wrongly; accepted |
| Email addresses | Notifications are only sent to confirmed addresses. Confirm and reset links are one-time, expire (24 h / 1 h), and only a SHA-256 hash is stored |
| Link poisoning | Links in emails are built from `APP_URL`, never from the request's Host header in production |
| Password reset | Same answer for known and unknown emails; a reset signs out every older session; opening the link also confirms the address |
| Data removal | Delete account (password required) removes the user and, by database cascade, the encrypted e-GURO password, courses, activities, notifications and tokens (tested) |
| Owner visibility | `/api/admin/summary` needs `CRON_SECRET` and returns counts only |
| Privacy | `/privacy` states plainly that the e-GURO password is stored encrypted and who can reach the database |

Still limitations: in-memory rate limiting is per server instance; no CAPTCHA; the site owner holds both the database and the encryption key, so students must trust them; e-GURO may have rules about automated access.
