// Writes sample emails to email-preview-*.html so you can open them in a browser. Run: npx tsx scripts/dev/email-preview.ts
// The samples are made up for the preview only.
import { writeFileSync } from "node:fs";
import { buildEmail } from "../../services/email/templates";

const samples = [
  { name: "assessment", activity: { type: "QUIZ" as const, lmsType: "EXAM", title: "Midterm Assessment: Normalization", courseLabel: "CS 201 Database Management Systems", postedAt: new Date("2026-10-05T01:30:00Z"), detectedAt: new Date("2026-10-05T01:44:00Z"), dueDate: new Date("2026-10-09T15:59:00Z"), url: "https://lms.ccc.edu.ph/app/open_exam.php?id=19196&param=101&terms=2" } },
  { name: "activity", activity: { type: "ACTIVITY" as const, lmsType: "LESSON", title: "Database Activity 04", courseLabel: "CS 201 Database Management Systems", postedAt: null, detectedAt: new Date("2026-10-05T01:44:00Z"), dueDate: null, url: null } },
];
for (const sample of samples) {
  const email = buildEmail(sample.activity, "https://lms.ccc.edu.ph", "https://your-app.vercel.app/settings");
  writeFileSync(`email-preview-${sample.name}.html`, email.html);
  console.log(`--- ${sample.name}\nSubject: ${email.subject}\n${email.text}`);
}
