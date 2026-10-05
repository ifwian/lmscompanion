# Deployment (free tier)

Nothing here has been tested on a real Vercel or Neon account yet. Treat each step as "to be verified" and check the box in `MANUAL_STEPS.md` only after you see it work.

## Architecture

```
GitHub Actions (every ~15 min)  --POST /api/cron/check + CRON_SECRET-->  Vercel app  --> e-GURO
                                                                          |  \--> Gmail SMTP
                                                                          \--> Neon Postgres
```

The checker runs on Vercel, so e-GURO sees requests from Vercel, not from GitHub. The scheduler only knocks on the door.

## Steps

1. **Repository.** Create a GitHub repository, push this project. `.env` is ignored by `.gitignore`; confirm with `git status`.
2. **Database.** Create a free Neon project and copy its connection string (keep `?sslmode=require`).
3. **Vercel.** Import the repository. Framework preset: Next.js. Add the environment variables listed in `.env.example` (all except the optional tuning ones).
4. **Tables.** From your computer, with `DATABASE_URL` set to the production string, run `npm run db:deploy`. Run it again whenever a new folder appears in `prisma/migrations`.
5. **Deploy**, then open `/status` on the Vercel address. Database should say CONNECTED.
6. **Scheduler.** Add the GitHub repository secrets `APP_URL` and `CRON_SECRET`. Run the "Check LMS" workflow once by hand (Actions tab > Check LMS > Run workflow). A green run prints `HTTP status: 200` and a JSON summary.
7. **Production test:** register, connect e-GURO, Check now, confirm the email arrives, run the workflow twice, confirm no duplicate email.

## Limits to remember

- Vercel's free plan only allows once-a-day Vercel Cron jobs, which is why the schedule lives in GitHub Actions. Limits change; re-check Vercel's documentation.
- GitHub scheduled runs can be delayed and may be paused on inactive repositories.
- Function time limits are short on the free plan. One checker run handles at most `MAX_USERS_PER_RUN` students (default 10) and stops after about 50 seconds; the next run continues with whoever is due.
- Each check of one student makes about 14 requests to e-GURO, spaced about 0.3 s apart.

## Changing the check interval

Edit the `cron:` line in `.github/workflows/check.yml` (GitHub's minimum is 5 minutes) and `CHECK_INTERVAL_MINUTES` (default 15, minimum 5). Please keep it gentle on the college server.
