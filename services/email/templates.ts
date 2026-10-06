// Plain, simple email text. Everything that came from e-GURO is escaped before going into HTML.
import type { ActivityType } from "../../generated/prisma/client";

const TYPE_LABEL: Record<ActivityType, string> = {
  ACTIVITY: "Activity",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  ANNOUNCEMENT: "Announcement",
};

export type EmailActivity = {
  type: ActivityType;
  title: string;
  courseLabel: string | null;
  detectedAt: Date;
  dueDate: Date | null;
  url: string | null;
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim(); // no line breaks in email headers
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" });
}

export function buildEmail(activity: EmailActivity, lmsUrl: string) {
  const label = TYPE_LABEL[activity.type];
  const subject = oneLine(
    activity.courseLabel
      ? `[ e-GURO ] New ${label} in ${activity.courseLabel}`
      : `[ e-GURO ] New ${label}: ${activity.title}`,
  );
  const link = activity.url ?? lmsUrl;

  const lines: [string, string][] = [];
  if (activity.courseLabel) lines.push(["Course", activity.courseLabel]);
  lines.push([label, activity.title]);
  lines.push(["Detected", formatDate(activity.detectedAt)]);
  if (activity.dueDate) lines.push(["Due", formatDate(activity.dueDate)]);

  const text =
    `New LMS ${label.toLowerCase()} detected.\n\n` +
    lines.map(([k, v]) => `${k}:\n${v}\n`).join("\n") +
    `\nOpen e-GURO:\n${link}\n\n` +
    `You are receiving this because notifications are on in your e-GURO Companion settings.\n`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:32rem">` +
    `<p>New LMS ${escapeHtml(label.toLowerCase())} detected.</p>` +
    lines
      .map(([k, v]) => `<p style="margin:0 0 12px"><span style="color:#666;font-size:13px">${escapeHtml(k)}</span><br>${escapeHtml(v)}</p>`)
      .join("") +
    `<p><a href="${escapeHtml(link)}" style="color:#111">Open e-GURO</a></p>` +
    `<p style="color:#666;font-size:12px">You are receiving this because notifications are on in your e-GURO Companion settings.</p>` +
    `</div>`;

  return { subject, text, html };
}
