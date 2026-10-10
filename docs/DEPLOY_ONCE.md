# Put it online once (owner only, about 30 minutes)

After this, classmates just open your link. Nothing here has been run on a real Vercel, Neon or Gmail account by me: tick each step only when you see it work, and tell me where it breaks. Free plans change; re-check limits.

## 0. On your computer
```bash
npm install
npm run setup
```
`npm run setup` makes your secret keys for you, asks for your database address (Neon) and Gmail sender, writes `.env`, creates the tables, and can send a test email. It also suggests an invite code for classmates.

Get the two things it asks for:
- **Database:** neon.tech, create a project, copy the connection string (starts with `postgresql://`).
- **Gmail sender:** make a NEW Gmail just for this app, turn on 2-Step Verification, then myaccount.google.com/apppasswords to make a 16-letter app password.

## 1. GitHub
Push the project to a GitHub repository. `.env` is ignored by Git (check `git status` does not list it).

## 2. Vercel (free "Hobby" plan, for non-commercial use)
1. vercel.com, sign in with GitHub, **Add New > Project**, import the repository.
2. Add the environment variables from your `.env`: `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `LMS_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `CRON_SECRET`, `INVITE_CODE`. (Vercel lets you paste several `KEY=value` lines at once. If yours does not, add them one by one.)
3. Deploy. Copy the address Vercel gives you (like `https://your-app.vercel.app`).
4. **Add `APP_URL`** = that address (no trailing slash) in Vercel, then **redeploy**. Confirm-email and reset-password links are built from it. Without it those emails are not sent.
5. Open `https://your-app.vercel.app/status`: Database CONNECTED, Database updates UP-TO-DATE.

Keep `ENCRYPTION_KEY` backed up somewhere private. If you lose it, everyone must reconnect e-GURO.

## 2b. Production settings (new)
- **Pooled database address:** in Neon, copy the connection string with "Pooled connection" ticked (the host has `-pooler`) and use it as `DATABASE_URL` in Vercel. Also add `DIRECT_URL` with the non-pooled string. The build uses it to apply new database migrations by itself on every production deploy, so you no longer run `npm run db:deploy` by hand.
- **Region:** Vercel project > Settings > Functions > pick the region closest to your Neon database.
- **CI:** the file `.github/workflows/ci.yml` runs the checks on every change. In GitHub > Settings > Branches, add a rule for `main` with "Require status checks to pass" (CI). Work on a branch and merge through a pull request.
- **Uptime alerts:** make a free UptimeRobot account and add an HTTP monitor for `https://YOUR-SITE/api/health?strict=1` every 5 minutes. It emails you if the database is down, a setting is missing, or the checker stopped.
- **Backup:** run `npm run backup` now. Keep the file and `ENCRYPTION_KEY` in two different places. See `docs/RUNBOOK.md`.

## 3. Scheduler (this is what checks e-GURO for everyone)
Pick ONE:

**A. cron-job.org (free, works with a private repository).** Create a job: URL `https://your-app.vercel.app/api/cron/check`, method POST, every 5 minutes, and add a request header `Authorization` with the value `Bearer YOUR_CRON_SECRET`. (As far as I know this is free; check their current limits.) Then turn the GitHub workflow off: `gh workflow disable "Check LMS"`.

**B. GitHub Actions.** The file `.github/workflows/check.yml` already runs every 5 minutes. Add repository secrets `APP_URL` and `CRON_SECRET`. **GitHub's free plan gives private repositories only 2,000 Actions minutes a month, and a run every 5 minutes uses far more.** Public repositories are free. So use B only if your repository is public (your secrets stay safe in GitHub Secrets and Vercel, never in the code), otherwise use A.

Each student is still only checked every 15 minutes; the 5-minute call just picks up whoever is due.

## 4. Test as a student would
Open your site in a private browser window. Sign up with the invite code, confirm the email, connect e-GURO, click Check now, press Send test email. Then run the scheduler once by hand and check there is no duplicate email.

## 5. Invite classmates
Send them the link, the invite code and `docs/FOR_CLASSMATES.md`.

## Keeping an eye on it
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/admin/summary
```
Shows counts only: students, confirmed emails, connections by status, pending or failed emails, minutes since the last check. No names, emails or passwords.

## Capacity (rough)
One check of one student = 1 login and about 7 reads, spaced out. The checker handles 25 students per run, 3 at a time, and stops after 4 minutes (Vercel Hobby allows up to 5). Dozens of classmates is fine. Raise `MAX_USERS_PER_RUN` if you have more; keep `CHECK_CONCURRENCY` at 3 or less and the interval at 15 minutes or more to stay gentle on the college server.

## Limits to watch
- A normal Gmail account can only send so many emails per day (about 500 as far as I know). One email per new item, so this is fine for a class.
- Neon free storage is small but this app stores little.
- Vercel Hobby is for non-commercial use. Do not charge for this.

## Updating later
Push to GitHub and Vercel redeploys. If a new folder appears in `prisma/migrations`, run `npm run db:deploy` on your computer with `DATABASE_URL` set to the production database.

## Your responsibilities
- You store classmates' e-GURO passwords (encrypted). Protect `DATABASE_URL`, `ENCRYPTION_KEY` and your Vercel, GitHub, Neon and Gmail logins with strong passwords and 2-step verification.
- Tell classmates the truth (the privacy page does) and let them leave: Disconnect and Delete account are in Settings.
- Ask the CCC ICT office whether this kind of tool is allowed.
