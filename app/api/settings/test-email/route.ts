import { config } from "@/lib/config";
import { jsonError, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { buildTestEmail } from "@/services/email/templates";
import { explainMailError, isEmailConfigured, sendMail } from "@/services/email/transport";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// "Send test email": sends a clearly-marked sample message to the logged-in student's own address.
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;

  if (isRateLimited(`test-email:${auth.user.id}`, 3, 10 * 60 * 1000)) {
    return jsonError("Please wait a few minutes before sending another test email.", 429);
  }
  if (!auth.user.emailVerifiedAt) {
    return jsonError("Confirm your email address first (use the link we emailed you, or ask for a new one at the top of the page).", 403);
  }
  if (!isEmailConfigured()) {
    return jsonError("Email is not set up on the server yet. Fill in SMTP_USER, SMTP_PASSWORD and MAIL_FROM in .env, then restart the app.", 503);
  }

  const email = buildTestEmail(config.lmsBaseUrl(), config.appUrl() ? `${config.appUrl()}/settings` : null);
  try {
    await sendMail(auth.user.email, email.subject, email.text, email.html);
  } catch (error) {
    return jsonError(explainMailError(error), 502);
  }
  return Response.json({ ok: true, message: `Test email sent to ${auth.user.email}. Check your inbox and spam folder.` });
}
