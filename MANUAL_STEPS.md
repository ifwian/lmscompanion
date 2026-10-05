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

## B. Finish the real e-GURO connection (the most important step)

**Where things stand:** your first real test showed that logging in to e-GURO is accepted, but reading the list of activities fails with "e-GURO responded in a way this app does not understand yet". So the login part probably works and the part that reads the activity list needs fixing. I cannot see e-GURO, so I need a safe report from your computer.

- [ ] In the project folder run:
  ```bash
  npm run lms:diagnose
  ```
  It asks for your e-GURO username and password (typing is hidden, nothing is saved), logs in **once**, and only reads pages. It writes `diagnose-output.txt`.
- [ ] Open `diagnose-output.txt` and read it. By default it hides text such as course names and titles and shows only page structure, addresses, field names and sizes. It never prints your password or cookie values.
- [ ] Send me the contents of `diagnose-output.txt`. I will then fix `services/lms/client.ts` and `services/lms/parsers.ts` (the only e-GURO-specific files).
- [ ] If the report does not show where the activities come from, send a browser capture instead: open https://lms.ccc.edu.ph in Chrome, press F12 > Network (tick Preserve log), log in, open your activities page, then save the requests as a HAR file. **Before sharing, replace your password and every `cookie` / `set-cookie` value with `REDACTED`.**
- [ ] Do not keep clicking "Check now" while it fails. The app already backs off by itself, and repeated attempts only add load on the college's server.
- [ ] After the fix, click **Check now**. The first successful check saves your current items silently (no emails). Then wait for something new to be posted to see a real notification.

## C. What the app cannot do yet (needs the capture from step B)

- **Courses list:** stays empty until we find where e-GURO shows course names.
- **Announcements:** not read yet (no verified endpoint).
- **Item links:** emails link to the e-GURO home page, not the exact item.
- **Type guesses:** `ACTIVITY_QUIZ` is treated as a quiz and `SUBMIT_ANSWER` as an assignment; everything else is an "activity". These are assumptions from the old script.

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
