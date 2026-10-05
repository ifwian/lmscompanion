# Things YOU must do manually

Everything the code can do is done. These steps need your accounts, your passwords or your own browser, so I could not do them. Do them in this order and tick each box.

## A. Run it on your computer (about 20 minutes)

- [ ] **Install Node.js 20 or newer** (nodejs.org). Check with `node -v`.
- [ ] **Create a free database.** Go to neon.tech, sign up, create a project, and copy the connection string (it starts with `postgresql://`).
- [ ] **Create the Gmail sender account.** Make a NEW Gmail just for this project (not your personal one). Turn on 2-Step Verification, then create an App password at myaccount.google.com/apppasswords. Copy the 16-character password.
- [ ] **Create your `.env` file:**
  ```bash
  cp .env.example .env
  ```
  Open `.env` and fill in:
  - `DATABASE_URL` = the Neon connection string
  - `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` = three DIFFERENT random values. Generate each with:
    `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - `SMTP_USER` = the project Gmail address, `SMTP_PASSWORD` = the app password, `MAIL_FROM` = `e-GURO Companion <that gmail address>`
  - **Back up `ENCRYPTION_KEY` somewhere safe.** If you lose it, every stored e-GURO password becomes unreadable and everyone must reconnect.
- [ ] **Install and create the tables:**
  ```bash
  npm install
  npm run db:deploy
  npm run dev
  ```
  Open http://localhost:3000, register, then open `/status` to confirm the database is connected.

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

## D. Put it online for free

- [ ] **GitHub:** create a repository (private is fine) and push the code. Check that `.env` is NOT in the commit (`git status` must not list it).
- [ ] **Vercel:** sign up (free Hobby plan), import the repository, and add these Environment Variables (same values as your `.env`, with `LMS_BASE_URL=https://lms.ccc.edu.ph`): `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `LMS_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `CRON_SECRET`.
- [ ] **Create the tables in the production database.** On your computer, with `DATABASE_URL` set to the production string: `npm run db:deploy`.
- [ ] **Deploy** in Vercel, then open `https://YOUR-APP.vercel.app/status`.
- [ ] **Scheduler:** in your GitHub repo go to Settings > Secrets and variables > Actions and add `APP_URL` (your Vercel address, no trailing slash) and `CRON_SECRET` (same value as on Vercel). Then open the Actions tab, pick "Check LMS", and click **Run workflow** to test it. GitHub runs it about every 15 minutes and can be late.
- [ ] **Repository activity:** GitHub may pause scheduled workflows on repositories with no activity for a long time. If checks stop, re-enable the workflow in the Actions tab.
- [ ] **Test on production:** register, connect e-GURO, click Check now, confirm an email arrives, run the workflow twice and confirm there is no duplicate email.

## E. Before inviting classmates

- [ ] Tell them plainly: the app stores their e-GURO password (encrypted) so it can check for them. They can remove it any time with **Disconnect** in Settings.
- [ ] Consider asking the CCC ICT office whether this kind of tool is allowed. The checker is deliberately gentle (every 15 minutes, a few requests per student), but the college may have a policy.
- [ ] Gmail limits how many emails one account can send per day. That is fine for a small group.
- [ ] Change any password that was ever stored in the old GitHub Secrets.

## F. Things to know

- Free tiers can change. Re-check Vercel, Neon and GitHub limits before relying on them.
- The in-app rate limiting is per server instance (best effort).
- Logging out clears the cookie in your browser; a copied session token stays valid up to 7 days unless the password is changed.
- I could not view the pages in a real browser in my environment. Please open every page (Overview, Courses, Activities, Notifications, Settings) on desktop and on your phone and tell me what looks wrong.
