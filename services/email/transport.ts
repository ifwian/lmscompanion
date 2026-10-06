// Sends mail through SMTP. Free setup: a dedicated Gmail account + an "app password".
// All settings come from environment variables (never from the browser).
import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

// "Configured" means: a sender address, and either a login (user + password) or an explicit SMTP host
// (for a local test mail server that needs no login).
export function isEmailConfigured(): boolean {
  if (!process.env.MAIL_FROM) return false;
  const hasLogin = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  return hasLogin || Boolean(process.env.SMTP_HOST);
}

function getTransport(): Transporter {
  if (cached) return cached;
  const user = process.env.SMTP_USER;
  // Google shows app passwords in groups ("abcd efgh ijkl mnop"). The spaces are not part of the password.
  const password = (process.env.SMTP_PASSWORD ?? "").replace(/\s+/g, "");
  const port = Number.parseInt(process.env.SMTP_PORT ?? "465", 10);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: user && password ? { user, pass: password } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cached;
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  await getTransport().sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
}

// Turns a mail error into a short message a person can act on. It never includes the raw error text
// (that can contain addresses or credentials).
export function explainMailError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number };
  if (e?.code === "EAUTH" || e?.responseCode === 535) {
    return "The mail server rejected the login. Check SMTP_USER and SMTP_PASSWORD (for Gmail: a 16-letter app password, and 2-Step Verification must be on).";
  }
  if (e?.code === "EENVELOPE" || e?.responseCode === 550 || e?.responseCode === 553) {
    return "The mail server did not accept the sender or recipient address. Check MAIL_FROM (it should use the same Gmail address as SMTP_USER).";
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED"].includes(e?.code ?? "")) {
    return "Could not reach the mail server. Check SMTP_HOST and SMTP_PORT, and your internet connection.";
  }
  return "Sending failed for an unknown reason. Check the SMTP settings.";
}
