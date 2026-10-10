// Alert emails to the person who runs the site.
// Two triggers, both about a single checker run: many student checks failing at once, and e-GURO
// answering in a layout the app no longer recognises.
// Nothing belonging to a student goes out through here, and every value is passed through scrub()
// first, which removes email addresses, tokens, passwords and database connection strings.
import { config } from "@/lib/config";
import { logError, scrub } from "@/lib/log";
import { getState, setState } from "@/lib/system";
import { buildOwnerAlertEmail } from "./templates";
import { isEmailConfigured, sendMail } from "./transport";

export type OwnerAlertKind = "checker" | "parser";

export type OwnerAlertInput = {
  kind: OwnerAlertKind;
  subject: string;
  kicker: string;
  title: string;
  details: [string, string][];
  footer: string;
};

export const ALERT_FOOTER = "Sent by e-GURO Companion because the checker hit a problem worth a human's attention. No student passwords or addresses are ever included.";

// One alert per kind per cooldown window, so a site that is broken for hours cannot fill the inbox every 15 minutes.
async function inCooldown(kind: OwnerAlertKind): Promise<boolean> {
  const previous = await getState(`owner_alert_${kind}_at`);
  if (!previous) return false;
  const sentAt = Date.parse(previous.value);
  if (Number.isNaN(sentAt)) return false;
  return Date.now() - sentAt < config.ownerAlertCooldownMinutes() * 60 * 1000;
}

// Returns true when the alert was actually sent. Never throws: alerting must not break a check run.
export async function sendOwnerAlert(alert: OwnerAlertInput): Promise<boolean> {
  const to = config.ownerAlertEmail();
  if (!to || !isEmailConfigured()) return false; // alerts stay off until an address and SMTP are set
  if (await inCooldown(alert.kind)) return false;

  const mail = buildOwnerAlertEmail(
    {
      subject: alert.subject,
      kicker: alert.kicker,
      title: alert.title,
      details: alert.details.map(([label, value]) => [label, scrub(value)] as [string, string]),
      footer: alert.footer,
    },
    config.appUrl() ?? config.lmsBaseUrl(),
  );

  try {
    await sendMail(to, mail.subject, mail.text, mail.html);
  } catch (error) {
    // The raw SMTP error is never put in the state key or the console: it can contain addresses.
    await logError("owner-alert", error, { code: alert.kind });
    return false;
  }
  await setState(`owner_alert_${alert.kind}_at`, new Date().toISOString());
  return true;
}