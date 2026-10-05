// Sends ONE test email using the settings in your .env, so you can check email works without waiting for a new item.
//   npm run email:test                      (sends to your SMTP_USER address)
//   npm run email:test -- someone@example.com
import "dotenv/config";
import { config } from "../lib/config";
import { buildTestEmail } from "../services/email/templates";
import { explainMailError, isEmailConfigured, sendMail } from "../services/email/transport";

async function main() {
  if (!isEmailConfigured()) {
    console.error("Email is not set up. Fill in SMTP_USER, SMTP_PASSWORD and MAIL_FROM in .env (see .env.example) and try again.");
    process.exit(1);
  }
  const to = process.argv[2] || process.env.SMTP_USER;
  if (!to) {
    console.error("No recipient. Run: npm run email:test -- you@example.com");
    process.exit(1);
  }
  const email = buildTestEmail(config.lmsBaseUrl(), config.appUrl() ? `${config.appUrl()}/settings` : null);
  try {
    await sendMail(to, email.subject, email.text, email.html);
    console.log(`Sent. Check the inbox (and spam folder) of ${to}.`);
  } catch (error) {
    console.error("Failed:", explainMailError(error));
    process.exit(1);
  }
}

main();
