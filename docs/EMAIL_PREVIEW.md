# What the notification email looks like

Subject examples:
- `[ e-GURO ] New Assessment in CS 201 Database Management Systems`
- `[ e-GURO ] New Activity in CS 201 Database Management Systems`
- When the course is unknown: `[ e-GURO ] New Activity: <title>`

Body (black and white, readable on a phone): small "e-GURO Companion" header, the type ("NEW ASSESSMENT"), the title in large type, a table with Course, Type, Posted, Due (only if e-GURO gives one) and Detected, an "Open in e-GURO" button, a reminder to log in first, and a footer saying why you got it and where to change it.

A plain-text version is sent too, for mail apps that do not show HTML.

Preview it yourself without sending anything: `npx tsx scripts/dev/email-preview.ts`, then open `email-preview-assessment.html` in a browser. Screenshots: `docs/email-preview-desktop.png` and `docs/email-preview-phone.png`.

Known limits: one email per item (no digest yet); the item link opens the e-GURO page the website itself uses, and e-GURO may ask you to log in first.
