// Writes sample emails to email-preview-*.html so you can open them in a browser. Run: npx tsx scripts/dev/email-preview.ts
// The samples are made up for the preview only.
import { writeFileSync } from "node:fs";
import { buildEmail, buildOwnerAlertEmail, type OwnerAlertEmail } from "../../services/email/templates";

const FOOTER = "Sent by e-GURO Companion because the checker hit a problem worth a human's attention. No student passwords or addresses are ever included.";

const samples = [
  { name: "assessment", activity: { type: "QUIZ" as const, lmsType: "EXAM", title: "Midterm Assessment: Normalization", courseLabel: "CS 201 Database Management Systems", postedAt: new Date("2026-10-05T01:30:00Z"), detectedAt: new Date("2026-10-05T01:44:00Z"), dueDate: new Date("2026-10-09T15:59:00Z"), url: "https://lms.ccc.edu.ph/app/open_exam.php?id=19196&param=101&terms=2" } },
  { name: "activity", activity: { type: "ACTIVITY" as const, lmsType: "LESSON", title: "Database Activity 04", courseLabel: "CS 201 Database Management Systems", postedAt: null, detectedAt: new Date("2026-10-05T01:44:00Z"), dueDate: null, url: null } },
];
for (const sample of samples) {
  const email = buildEmail(sample.activity, "https://lms.ccc.edu.ph", "https://your-app.vercel.app/settings");
  writeFileSync(`email-preview-${sample.name}.html`, email.html);
  console.log(`--- ${sample.name}\nSubject: ${email.subject}\n${email.text}`);
}

// The two alerts the checker can send to the person who runs the site.
const alerts: { name: string; alert: OwnerAlertEmail }[] = [
  {
    name: "owner-alert-checker",
    alert: {
      subject: "[ e-GURO ] 4 student checks failed in one run",
      kicker: "Automated alert",
      title: "4 of 6 student checks failed",
      details: [
        ["Run finished", "Oct 10, 2026, 9:12 AM"],
        ["Students checked", "6"],
        ["Students failed", "4"],
        ["Failure codes", "TEMPORARY (3), AUTH_FAILED (1)"],
      ],
      footer: FOOTER,
    },
  },
  {
    name: "owner-alert-parser",
    alert: {
      subject: "[ e-GURO ] e-GURO changed its page layout (2 in one run)",
      kicker: "Automated alert",
      title: "e-GURO answered in a layout this app does not recognise",
      details: [
        ["Run finished", "Oct 10, 2026, 9:12 AM"],
        ["Students checked", "6"],
        ["Students failed", "2"],
        ["Failure codes", "FORMAT_CHANGED (2)"],
        ["Layout errors", "2"],
        ["Likely cause", "e-GURO changed one of its pages or endpoints, so the parser no longer recognises the answer."],
        ["Students affected", "Their last known data is kept; new work is not being collected until this is fixed."],
        ["What to do", "Run: npm run lms:diagnose, then npm run test:parsers, then update services/lms/client.ts and services/lms/parsers.ts."],
      ],
      footer: FOOTER,
    },
  },
];
for (const sample of alerts) {
  const email = buildOwnerAlertEmail(sample.alert, "https://your-app.vercel.app");
  writeFileSync(`email-preview-${sample.name}.html`, email.html);
  console.log(`--- ${sample.name}\nSubject: ${email.subject}\n${email.text}`);
}
