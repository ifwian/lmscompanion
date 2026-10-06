# Things YOU must do manually

Everything the code can do is done. These steps need your accounts, your passwords or your own browser, so I could not do them. Do them in this order and tick each box.

## A. Run it on your computer (owner, once)

- [ ] Install **Node.js 20 or newer** (nodejs.org). Check with `node -v`.
- [ ] Make a free **Neon** database (neon.tech) and copy its connection string.
- [ ] Make a NEW **Gmail** just for this app, turn on 2-Step Verification, and create an app password (myaccount.google.com/apppasswords).
- [ ] Then let the wizard do the rest. It makes the secret keys, writes `.env`, creates the tables and can test the email:
  ```bash
  npm install
  npm run setup
  npm run dev
  ```
  Open http://localhost:3000, sign up with the invite code it printed, then open `/status`.
- [ ] **Back up `ENCRYPTION_KEY`** (it is in `.env`) somewhere private. If you lose it, everyone must reconnect e-GURO.

## A2. Open it to your classmates (the new plan)

Students need NO setup: they open your link and sign up. You deploy once. Read `docs/ARCHITECTURE.md` (one page) and follow `docs/DEPLOY_ONCE.md`. Give classmates `docs/FOR_CLASSMATES.md` and the invite code.

## B. Update, then see your real pending activities

- [ ] Replace your project files with the new zip (the opencode prompt in the chat does this and keeps your `.env`). Then:
  ```bash
  npm install
  npm run db:deploy      # REQUIRED: adds the new columns for pending / unread. Without it, the dashboard and checks fail.
  npm run dev
  ```
- [ ] Open `http://localhost:3000/status`. The row **Database updates** must say UP-TO-DATE. If it says MISSING, run `npm run db:deploy` again.
- [ ] Log in, open **Overview**, click **Check now**. It tells you what it found, for example: "First check done. Found 1 pending and 19 unread lessons."
- [ ] **Overview** now has a big **Pending activities** section (missed first, then due today, then assigned, soonest deadline first) and a separate **Unread lessons** section. **Activities** has tabs: Pending, Unread, Read, All.
- [ ] Compare with the e-GURO dashboard: the Assigned / Due today / Missed cards should match the Pending list, and the Unread card should match Unread lessons.
- [ ] **Check the due date** of one pending item against the website. The app shows e-GURO's `date_deadline` (falling back to `to_date`). If it shows the wrong one, tell me which date the website shows.
- [ ] If something is wrong or empty, run `npm run lms:diagnose` and send me `diagnose-output.txt` (the file, not the terminal text). Do not keep clicking Check now.

Why there is no workaround: nothing had to be bypassed. The app reads the same lists the e-GURO dashboard shows you, through your own login. It does not touch anyone else's account.

## C. What the app cannot do yet

- **Announcements:** not read yet. The home page has an admin "splash" announcement table (`splash_table.php`); a future diagnostic can look at it.
- **Activities and quizzes are not told apart.** The site files both under the type LESSON ("Activity & Quiz") and exams under EXAM ("Assessment"). So LESSON items show as "Activity" and EXAM items as "Assessment" (they use the "quizzes" email switch). If the real rows carry another field that separates assignments, send a report and I will use it.
- **Pending** means what the site's own cards show: Assigned, Due today and Missed. Items you hand in leave the Pending list (they stay in Read). **Unread** is the site's Unread list (reading material).
- **Due dates** appear only if e-GURO sends a `to_date` for the item. Otherwise the page shows the posted date.

## C2. Make email work, and test it

Emails are only sent when a check finds something NEW, and the first check only saves what already exists. So you could wait a long time and see no email even when everything is set up correctly. Test it directly instead:

- [ ] In `.env` set (see `.env.example`): `SMTP_USER` (the project Gmail address), `SMTP_PASSWORD` (the Gmail **app password**; spaces in it are fine), `MAIL_FROM` (use the SAME Gmail address, for example `e-GURO Companion <that.address@gmail.com>`). 2-Step Verification must be on for that Gmail, or it cannot make app passwords.
- [ ] **Restart the app** after editing `.env` (stop it, run `npm run dev` again).
- [ ] Test, either way:
  - In the app: **Settings > Notifications > Send test email**. It sends to the email you registered with and tells you if it failed and why.
  - Or in the terminal: `npm run email:test` (sends to your SMTP_USER) or `npm run email:test -- you@example.com`.
- [ ] If it fails, the message says what to check: wrong login (re-create the app password), cannot reach the mail server, or sender address mismatch. Check your spam folder too.
- [ ] Real notifications: a check finds a new PENDING item (work to do) and the matching "New ..." switch in Settings is on. **New unread lessons never send email**, they only appear in the Unread section.
- Emails are sent when a check runs: **Check now**, `npm run check` (one check pass on your computer), or the online scheduler (section D). `npm run dev` alone never checks by itself.
- To get emails without deploying, run `npm run check` every 15 minutes yourself (for example with Windows Task Scheduler) while your computer is on. Do not go below 15 minutes.
- One email per new item. Old unsent notifications (older than 3 days) are skipped so fixing email later does not send a flood.
- Optional: `APP_URL` in `.env` (your deployed address) makes the email footer link to Settings. See `docs/EMAIL_PREVIEW.md`.

## C3. The GitHub "Check LMS" failure emails

You got "Run failed: Check LMS" emails because the scheduled workflow runs every 15 minutes but the app is not deployed yet (no `APP_URL` secret). The new `.github/workflows/check.yml` skips quietly until `APP_URL` and `CRON_SECRET` exist. To stop the emails right now, do either:
- [ ] `gh workflow disable "Check LMS" --repo ifwian/eGURO-Companion`  (turn it on again after deploying with `gh workflow enable ...`), or
- [ ] push the new workflow file to the repository's DEFAULT branch. Your default branch is `master` and the code is on `main`. GitHub only runs schedules from the default branch, so on GitHub go to Settings > Branches and make `main` the default (or merge `main` into `master`).

## D. Put it online

Follow `docs/DEPLOY_ONCE.md`. Two corrections to what I told you earlier: (1) GitHub's free plan gives PRIVATE repositories only 2,000 Actions minutes a month, so a scheduler on a private repository will run out; use a public repository or the free external scheduler described there. (2) Set `APP_URL` after the first deploy, or confirm-email and reset-password emails are not sent.

## E. Before inviting classmates (checklist)

- [ ] Tell them plainly: the app stores their e-GURO password (encrypted) so it can check for them. They can remove it any time with **Disconnect** in Settings.
- [ ] Consider asking the CCC ICT office whether this kind of tool is allowed. The checker is deliberately gentle (every 15 minutes, a few requests per student), but the college may have a policy.
- [ ] Gmail limits how many emails one account can send per day (about 500, as far as I know). That is fine for a class.
- [ ] Share the invite code only in your class chat. Use `/api/admin/summary` (counts only) to see how it is going.
- [ ] Change any password that was ever stored in the old GitHub Secrets.

## F. Things to know

- Free tiers can change. Re-check Vercel, Neon and GitHub limits before relying on them.
- The in-app rate limiting is per server instance (best effort).
- Logging out clears the cookie in your browser; a copied session token stays valid up to 7 days unless the password is changed.
- I could not view the pages in a real browser in my environment. Please open every page (Overview, Courses, Activities, Notifications, Settings) on desktop and on your phone and tell me what looks wrong.
