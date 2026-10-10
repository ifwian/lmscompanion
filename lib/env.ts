// Checks the settings the app needs and returns plain-language problems (never the values).
export function envProblems(): string[] {
  const problems: string[] = [];
  const need = (name: string) => !process.env[name]?.trim() && problems.push(`${name} is not set.`);
  need("DATABASE_URL");
  need("AUTH_SECRET");
  need("ENCRYPTION_KEY");
  need("CRON_SECRET");
  if ((process.env.AUTH_SECRET ?? "").length > 0 && (process.env.AUTH_SECRET ?? "").length < 32) problems.push("AUTH_SECRET is shorter than 32 characters.");
  if (process.env.ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY) && Buffer.from(process.env.ENCRYPTION_KEY, "base64").length !== 32) {
    problems.push("ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  }
  if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 16) problems.push("CRON_SECRET is shorter than 16 characters.");
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL) problems.push("APP_URL is not set: confirm-email and reset-password emails will not be sent.");
  if (!process.env.MAIL_FROM || !(process.env.SMTP_HOST || (process.env.SMTP_USER && process.env.SMTP_PASSWORD))) problems.push("Email is not fully set up (MAIL_FROM and SMTP_USER / SMTP_PASSWORD).");
  return problems;
}
