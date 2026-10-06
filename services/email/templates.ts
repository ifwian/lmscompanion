// The notification email. Plain, readable and professional: one item per email, black and white,
// built from tables with inline styles because that is what Gmail and Outlook render reliably.
// Everything that came from e-GURO is escaped before it goes into HTML.
import type { ActivityType } from "../../generated/prisma/client";

const TYPE_LABEL: Record<ActivityType, string> = {
  ACTIVITY: "Activity",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  ANNOUNCEMENT: "Announcement",
};

export type EmailActivity = {
  type: ActivityType;
  lmsType?: string | null;
  title: string;
  courseLabel: string | null;
  postedAt?: Date | null;
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

// Only http(s) links are allowed in the email.
function safeUrl(url: string | null, fallback: string): string {
  return url && /^https?:\/\//i.test(url) ? url : fallback;
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" });
}

function labelFor(activity: EmailActivity): string {
  return activity.lmsType === "EXAM" ? "Assessment" : TYPE_LABEL[activity.type];
}

export type EmailOptions = {
  kicker?: string; // replaces "New <type>" above the title (used by the test email)
  subject?: string; // replaces the generated subject
  footer?: string; // replaces the footer text
  hideLoginHint?: boolean;
};

export function buildEmail(activity: EmailActivity, lmsUrl: string, settingsUrl: string | null = null, options: EmailOptions = {}) {
  const label = labelFor(activity);
  const subject = oneLine(
    options.subject ??
      (activity.courseLabel
        ? `[ e-GURO ] New ${label} in ${activity.courseLabel}`
        : `[ e-GURO ] New ${label}: ${activity.title}`),
  );
  const kicker = options.kicker ?? `New ${label}`;
  const link = safeUrl(activity.url, lmsUrl);

  const details: [string, string][] = [];
  if (activity.courseLabel) details.push(["Course", activity.courseLabel]);
  details.push(["Type", label]);
  if (activity.postedAt) details.push(["Posted", formatDate(activity.postedAt)]);
  if (activity.dueDate) details.push(["Due", formatDate(activity.dueDate)]);
  details.push(["Detected", formatDate(activity.detectedAt)]);

  const footer = options.footer ?? (settingsUrl
    ? `You are receiving this because ${label.toLowerCase()} emails are turned on. Change this any time in Settings: ${settingsUrl}`
    : `You are receiving this because ${label.toLowerCase()} emails are turned on in your e-GURO Companion settings.`);

  const text =
    `${options.kicker ?? `New ${label.toLowerCase()} detected in e-GURO`}\n\n` +
    `${activity.title}\n\n` +
    details.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nOpen in e-GURO:\n${link}\n\n` +
    (options.hideLoginHint ? "" : `Log in to e-GURO first if it asks you to.\n\n`) +
    `--\n${footer}\n`;

  const mono = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace";
  const rows = details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:9px 0;border-top:1px solid #e5e5e5;font:11px/1.4 ${mono};letter-spacing:1px;text-transform:uppercase;color:#666666;width:96px;vertical-align:top">${escapeHtml(k)}</td>` +
        `<td style="padding:9px 0;border-top:1px solid #e5e5e5;font:15px/1.4 Arial,Helvetica,sans-serif;color:#111111;vertical-align:top">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f3f3">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px">${escapeHtml(activity.title)}${activity.courseLabel ? " · " + escapeHtml(activity.courseLabel) : ""}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3"><tr><td align="center" style="padding:28px 12px">` +
    `<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e0e0e0">` +
    `<tr><td style="padding:18px 28px;border-bottom:1px solid #e5e5e5;font:12px/1 ${mono};letter-spacing:2px;text-transform:uppercase;color:#111111">e-GURO <span style="color:#888888">Companion</span></td></tr>` +
    `<tr><td style="padding:30px 28px 6px">` +
    `<div style="font:11px/1 ${mono};letter-spacing:2px;text-transform:uppercase;color:#666666;padding-bottom:12px">${escapeHtml(kicker)}</div>` +
    `<div style="font:26px/1.2 Georgia,'Times New Roman',serif;color:#000000;padding-bottom:22px">${escapeHtml(activity.title)}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` +
    `<tr><td style="padding:26px 28px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#000000">` +
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 24px;font:13px/1 ${mono};letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">Open in e-GURO &rarr;</a>` +
    `</td></tr></table></td></tr>` +
    `<tr><td style="padding:0 28px 26px;font:12px/1.5 Arial,Helvetica,sans-serif;color:#666666">${options.hideLoginHint ? "" : "Log in to e-GURO first if it asks you to."}</td></tr>` +
    `<tr><td style="padding:16px 28px;border-top:1px solid #e5e5e5;font:12px/1.5 Arial,Helvetica,sans-serif;color:#777777">${escapeHtml(footer)}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

// The one-time account emails: confirm your address, and choose a new password. Same look as the
// notification email above, but no course and no LMS link, because neither applies here.
const ACCOUNT_COPY = {
  verify: {
    label: "Email verification",
    heading: "Confirm your email address",
    intro: "Confirm your address to finish setting up your e-GURO Companion account.",
    action: "Confirm email address",
    ignored: "If you did not create an account, you can ignore this email.",
  },
  reset: {
    label: "Password reset",
    heading: "Reset your password",
    intro: "Someone asked to reset the password for this account. Choose a new one using the link below.",
    action: "Reset password",
    ignored: "If you did not ask for this, nothing has changed and you can ignore this email.",
  },
} as const;

export function buildAccountEmail(type: "verify" | "reset", url: string, name: string) {
  const copy = ACCOUNT_COPY[type];
  const subject = oneLine(`[ e-GURO ] ${copy.heading}`);
  const link = safeUrl(url, "");
  const greeting = `Hello ${oneLine(name)},`;

  const text =
    `${greeting}\n\n${copy.intro}\n\n` +
    `${copy.action}: ${link}\n\n` +
    `This link can be used once and expires soon.\n\n` +
    `${copy.ignored}\n\n` +
    `--\ne-GURO Companion\n`;

  const mono = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace";
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f3f3">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px">${escapeHtml(copy.intro)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3"><tr><td align="center" style="padding:28px 12px">` +
    `<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e0e0e0">` +
    `<tr><td style="padding:18px 28px;border-bottom:1px solid #e5e5e5;font:12px/1 ${mono};letter-spacing:2px;text-transform:uppercase;color:#111111">e-GURO <span style="color:#888888">Companion</span></td></tr>` +
    `<tr><td style="padding:30px 28px 6px">` +
    `<div style="font:11px/1 ${mono};letter-spacing:2px;text-transform:uppercase;color:#666666;padding-bottom:12px">${escapeHtml(copy.label)}</div>` +
    `<div style="font:26px/1.2 Georgia,'Times New Roman',serif;color:#000000;padding-bottom:16px">${escapeHtml(copy.heading)}</div>` +
    `<div style="font:15px/1.5 Arial,Helvetica,sans-serif;color:#333333;padding-bottom:8px">${escapeHtml(greeting)}</div>` +
    `<div style="font:15px/1.5 Arial,Helvetica,sans-serif;color:#333333">${escapeHtml(copy.intro)}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:22px 28px 10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#000000">` +
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 24px;font:13px/1 ${mono};letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeHtml(copy.action)}</a>` +
    `</td></tr></table></td></tr>` +
    `<tr><td style="padding:0 28px 24px;font:13px/1.5 Arial,Helvetica,sans-serif;color:#666666">This link can be used once and expires soon.</td></tr>` +
    `<tr><td style="padding:16px 28px;border-top:1px solid #e5e5e5;font:12px/1.5 Arial,Helvetica,sans-serif;color:#777777">${escapeHtml(copy.ignored)}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

export function buildTestEmail(lmsUrl: string, settingsUrl: string | null = null) {
  return buildEmail(
    { type: "ACTIVITY", title: "Your e-GURO Companion email is working", courseLabel: null, detectedAt: new Date(), dueDate: null, url: null },
    lmsUrl,
    settingsUrl,
    {
      kicker: "Test email",
      subject: "[ e-GURO ] Test email",
      hideLoginHint: true,
      footer: "This is a test message you asked for. Real notifications look the same, with the item's course, type and due date.",
    },
  );
}
