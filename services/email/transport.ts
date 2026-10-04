// Sends mail through SMTP. Free setup: a dedicated Gmail account + an "app password".
// All settings come from environment variables (never from the browser).
import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.MAIL_FROM && (process.env.SMTP_HOST || process.env.SMTP_USER));
}

function getTransport(): Transporter {
  if (cached) return cached;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
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
