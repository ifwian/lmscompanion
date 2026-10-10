# What the notification email looks like

Subject examples:
- `[ e-GURO ] New Assessment in CS 201 Database Management Systems`
- `[ e-GURO ] New Activity in CS 201 Database Management Systems`
- When the course is unknown: `[ e-GURO ] New Activity: <title>`

Body (black and white, readable on a phone): small "e-GURO Companion" header, the type ("NEW ASSESSMENT"), the title in large type, a table with Course, Type, Posted, Due (only if e-GURO gives one) and Detected, an "Open in e-GURO" button, a reminder to log in first, and a footer saying why you got it and where to change it.

A plain-text version is sent too, for mail apps that do not show HTML.

Preview it yourself without sending anything: `npx tsx scripts/dev/email-preview.ts`, then open `email-preview-assessment.html` in a browser. Screenshots: `docs/email-preview-desktop.png` and `docs/email-preview-phone.png`.

## Owner alerts

The checker can also email the person who runs the site (not students). Same black-and-white card, sent through the same Gmail account:
- `[ e-GURO ] <n> student checks failed in one run` — when one run has at least `OWNER_ALERT_FAILURE_THRESHOLD` failures (default 3).
- `[ e-GURO ] e-GURO changed its page layout (<n> in one run)` — when one run has at least `OWNER_ALERT_FORMAT_THRESHOLD` layout errors (default 1).

The body lists the run time, how many students were checked, how many failed and the failure codes, plus what to do next. Every value is scrubbed first, so student addresses, tokens, passwords and database addresses can never appear. One alert per kind per `OWNER_ALERT_COOLDOWN_MINUTES` (default 60), so a site that stays broken cannot flood the inbox. Set `OWNER_ALERT_EMAIL` to turn this on.

Preview them without sending anything: `npx tsx scripts/dev/email-preview.ts`, then open `email-preview-owner-alert-checker.html` and `email-preview-owner-alert-parser.html`.

Known limits: one email per item (no digest yet); the item link opens the e-GURO page the website itself uses, and e-GURO may ask you to log in first.
