// The emails. Plain, readable and professional: black and white, built from tables with inline styles because
// that is what Gmail and Outlook render reliably. Everything that came from e-GURO is escaped before it goes into HTML.
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

// ---------- shared card layout ----------
type Card = {
  subject: string;
  preheader: string;
  kicker: string;
  title: string;
  details: [string, string][];
  buttonLabel: string;
  link: string;
  hint: string | null;
  footer: string;
  textIntro: string;
};

const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace";

function renderCard(card: Card) {
  const rows = card.details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:9px 0;border-top:1px solid #e5e5e5;font:11px/1.4 ${MONO};letter-spacing:1px;text-transform:uppercase;color:#666666;width:96px;vertical-align:top">${escapeHtml(k)}</td>` +
        `<td style="padding:9px 0;border-top:1px solid #e5e5e5;font:15px/1.4 Arial,Helvetica,sans-serif;color:#111111;vertical-align:top">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const text =
    `${card.textIntro}\n\n${card.title}\n\n` +
    (card.details.length ? card.details.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n" : "") +
    `${card.buttonLabel}:\n${card.link}\n\n` +
    (card.hint ? `${card.hint}\n\n` : "") +
    `--\n${card.footer}\n`;

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><title>${escapeHtml(card.subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f3f3">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px">${escapeHtml(card.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3"><tr><td align="center" style="padding:28px 12px">` +
    `<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e0e0e0">` +
    `<tr><td style="padding:18px 28px;border-bottom:1px solid #e5e5e5;font:12px/1 ${MONO};letter-spacing:2px;text-transform:uppercase;color:#111111">e-GURO <span style="color:#888888">Companion</span></td></tr>` +
    `<tr><td style="padding:30px 28px 6px">` +
    `<div style="font:11px/1 ${MONO};letter-spacing:2px;text-transform:uppercase;color:#666666;padding-bottom:12px">${escapeHtml(card.kicker)}</div>` +
    `<div style="font:26px/1.2 Georgia,'Times New Roman',serif;color:#000000;padding-bottom:22px">${escapeHtml(card.title)}</div>` +
    `</td></tr>` +
    (rows ? `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : "") +
    `<tr><td style="padding:26px 28px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#000000">` +
    `<a href="${escapeHtml(card.link)}" style="display:inline-block;padding:13px 24px;font:13px/1 ${MONO};letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeHtml(card.buttonLabel)} &rarr;</a>` +
    `</td></tr></table></td></tr>` +
    `<tr><td style="padding:0 28px 26px;font:12px/1.5 Arial,Helvetica,sans-serif;color:#666666">${card.hint ? escapeHtml(card.hint) : ""}</td></tr>` +
    `<tr><td style="padding:16px 28px;border-top:1px solid #e5e5e5;font:12px/1.5 Arial,Helvetica,sans-serif;color:#777777">${escapeHtml(card.footer)}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject: oneLine(card.subject), text, html };
}

// ---------- new item notification ----------
export type EmailOptions = {
  kicker?: string; // replaces "New <type>" above the title (used by the test email)
  subject?: string; // replaces the generated subject
  footer?: string; // replaces the footer text
  hideLoginHint?: boolean;
};

export function buildEmail(activity: EmailActivity, lmsUrl: string, settingsUrl: string | null = null, options: EmailOptions = {}) {
  const label = labelFor(activity);
  const subject =
    options.subject ??
    (activity.courseLabel ? `[ e-GURO ] New ${label} in ${activity.courseLabel}` : `[ e-GURO ] New ${label}: ${activity.title}`);

  const details: [string, string][] = [];
  if (activity.courseLabel) details.push(["Course", activity.courseLabel]);
  details.push(["Type", label]);
  if (activity.postedAt) details.push(["Posted", formatDate(activity.postedAt)]);
  if (activity.dueDate) details.push(["Due", formatDate(activity.dueDate)]);
  details.push(["Detected", formatDate(activity.detectedAt)]);

  const footer =
    options.footer ??
    (settingsUrl
      ? `You are receiving this because ${label.toLowerCase()} emails are turned on. Change this any time in Settings: ${settingsUrl}`
      : `You are receiving this because ${label.toLowerCase()} emails are turned on in your e-GURO Companion settings.`);

  return renderCard({
    subject,
    preheader: activity.courseLabel ? `${activity.title} · ${activity.courseLabel}` : activity.title,
    kicker: options.kicker ?? `New ${label}`,
    title: activity.title,
    details,
    buttonLabel: "Open in e-GURO",
    link: safeUrl(activity.url, lmsUrl),
    hint: options.hideLoginHint ? null : "Log in to e-GURO first if it asks you to.",
    footer,
    textIntro: options.kicker ?? `New ${label.toLowerCase()} detected in e-GURO`,
  });
}

// The message sent by "Send test email" (Settings) and by "npm run email:test". Clearly marked as a test.
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

// ---------- owner alerts ----------

export type OwnerAlertEmail = {
  subject: string;
  kicker: string;
  title: string;
  details: [string, string][];
  footer: string;
};

// Operational alerts for the person who runs the site: many student checks failing in one run, or
// e-GURO answering in a layout the app no longer recognises. Values arrive already scrubbed.
export function buildOwnerAlertEmail(alert: OwnerAlertEmail, link: string) {
  return renderCard({
    subject: alert.subject,
    preheader: alert.title,
    kicker: alert.kicker,
    title: alert.title,
    details: alert.details,
    buttonLabel: "Open the app",
    link: safeUrl(link, link),
    hint: null,
    footer: alert.footer,
    textIntro: alert.kicker,
  });
}

// ---------- account emails ----------

export function buildAccountEmail(kind: "verify" | "reset", link: string, name: string) {
  const first = oneLine(name).split(" ")[0] || "there";
  if (kind === "verify") {
    return renderCard({
      subject: "[ e-GURO ] Confirm your email address",
      preheader: "Confirm your email so e-GURO Companion can send you notifications.",
      kicker: "Confirm your email",
      title: `Hi ${first}, please confirm your email address`,
      details: [],
      buttonLabel: "Confirm email",
      link,
      hint: "This link works once and expires in 24 hours.",
      footer: "You get this because someone signed up for e-GURO Companion with this address. If it was not you, ignore this email and nothing will happen.",
      textIntro: "Confirm your e-GURO Companion email address",
    });
  }
  return renderCard({
    subject: "[ e-GURO ] Reset your password",
    preheader: "Use this link to choose a new e-GURO Companion password.",
    kicker: "Password reset",
    title: `Hi ${first}, choose a new password`,
    details: [],
    buttonLabel: "Reset password",
    link,
    hint: "This link works once and expires in 1 hour.",
    footer: "You get this because a password reset was requested for your e-GURO Companion account. If it was not you, ignore this email: your password stays the same.",
    textIntro: "Reset your e-GURO Companion password",
  });
}
