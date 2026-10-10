# When something goes wrong

Start with `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-SITE/api/admin/summary` (counts and recent scrubbed errors only) and `https://YOUR-SITE/api/health?strict=1`.

| What you see | What it usually means | What to do |
|---|---|---|
| UptimeRobot says the health check is down and `checker.stale` is true | The scheduler stopped | Open cron-job.org (or the GitHub Actions tab) and check the job ran; check the secret `CRON_SECRET` matches Vercel |
| Many students show "needs to be updated" (AUTH_ERROR) at once | e-GURO changed its login, or locked accounts | Run `npm run lms:diagnose` yourself and look at the login step; do not retry in a loop |
| `errors.recent` shows `FORMAT_CHANGED` | e-GURO changed its pages | Run `npm run lms:diagnose`, send me the file |
| `errors.recent` shows `DATABASE_ERROR` | A migration is missing or the database is down | Open `/status`; redeploy (it applies migrations) |
| Emails stop (`emails.failed` rising) | Gmail login or daily limit | Open Settings > Send test email; check the app password; Gmail limits daily sending |
| You get an alert email: "student checks failed in one run" | One run hit `OWNER_ALERT_FAILURE_THRESHOLD` failures at once | Usually the network or e-GURO is down, not the students. Check `checker.lastSummary` in `/api/admin/summary` and the failure codes in the email. Nothing to do if the next run recovers |
| You get an alert email: "e-GURO changed its page layout" | e-GURO changed a page or endpoint; the parser no longer recognises the answer | This is the one failure students cannot fix themselves. Run `npm run lms:diagnose`, then `npm run test:parsers`, then update `services/lms/client.ts` and `services/lms/parsers.ts`. Students keep their last known data meanwhile |
| No alert emails arrive but you expected one | Alerts are off, or the cooldown has not passed | `OWNER_ALERT_EMAIL` must be set; one alert per kind per `OWNER_ALERT_COOLDOWN_MINUTES`. To test again, delete the `owner_alert_checker_at` / `owner_alert_parser_at` row in `system_state` |
| `/status` says a setting is NOT SET | A Vercel variable is missing | Add it in Vercel, redeploy |
| A bad deploy | A bug shipped | Vercel > Deployments > pick the last good one > Instant Rollback |
| The database was damaged or deleted | Mistake or provider problem | New Neon database, `DATABASE_URL` pointing at it, `npm run db:deploy`, then `npm run restore -- backups/FILE.enc` |
| You think a secret leaked | Anything pasted somewhere public | Change it everywhere. `AUTH_SECRET` and `CRON_SECRET`: change in Vercel, everyone logs in again. Database password: change in Neon. `ENCRYPTION_KEY`: you cannot just change it (old passwords become unreadable); ask me first |
| A student asks to be removed | Their right | They use Settings > Delete account; if they cannot, delete their row in Neon (everything linked is removed) |

Backups: `npm run backup` every week or after big changes. Keep the file and `ENCRYPTION_KEY` in different places.
