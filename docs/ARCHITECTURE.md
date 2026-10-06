# How it works for many students (one site, nothing for students to set up)

```
 Classmates (browser, phone)                  You (the owner), once
        |                                            |
        v                                            v
  https://your-app.vercel.app   <--- deploys ---  GitHub repository
        |   (one hosted copy of this project)
        |
        +--> Neon database ........ accounts, encrypted e-GURO passwords, items, notifications
        +--> Gmail SMTP ........... one sender account for everyone's emails
        +--> e-GURO (lms.ccc.edu.ph) ... each student's own login, read-only

  Scheduler (free) --every 5 min--> POST /api/cron/check (secret) --> checks the students who are due (every 15 min each)
```

**There is nothing to wrap or redesign.** The code was already multi-user: every table has a `user_id`, every query is scoped to the logged-in student, and e-GURO passwords are entered in the website and stored encrypted. The long manual guide was the *owner's* one-time setup. Students never see GitHub, Neon, Vercel or `.env`.

| Who | What they do |
|---|---|
| Student | Open the link, sign up with the invite code, confirm email, connect e-GURO. About 2 minutes. |
| You (once) | `npm run setup`, push to GitHub, import into Vercel, set a free scheduler. See `docs/DEPLOY_ONCE.md`. |

## What makes it safe to open to classmates (added in this version)
- **Invite code** (`INVITE_CODE`): strangers cannot sign up. Share the code in your class group chat.
- **Privacy notice + consent** at sign-up (`/privacy`). It says plainly that the password is stored (encrypted).
- **Email confirmation**: notifications are only sent to addresses that were confirmed.
- **Forgot password** by email, with one-time links that expire.
- **Disconnect** (removes the stored e-GURO password) and **Delete my account** (removes everything).
- **Owner summary** (`/api/admin/summary`): counts only, so you can see how many students are connected or broken without seeing anyone's data.
- **Checker for many students**: a few students at a time, each only when their own 15-minute timer is due.

## Things deliberately NOT done
- **Per-student GitHub or Vercel**: pointless, and each would need the student's password in a repository secret.
- **Storing e-GURO session cookies instead of passwords**: e-GURO sessions expire and we do not know how long they last, so the app would stop working while students sleep. Storing the encrypted password is what makes background checking possible. It is a real trust decision, which is why the privacy notice says so.
- **A big admin panel**: not needed for a class-sized group.

## Honest risks to decide on
1. You hold the database and the encryption key. Classmates are trusting you.
2. The college may have rules about automated access, and all students' requests come from the same server address. Ask the CCC ICT office.
3. Free plans have limits and can change (Gmail daily sending, Neon storage, Vercel Hobby is for non-commercial use, GitHub free Actions minutes).
