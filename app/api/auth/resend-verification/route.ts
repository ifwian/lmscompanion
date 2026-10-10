import { jsonError, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { createAuthToken } from "@/lib/auth/tokens";
import { linkBase } from "@/lib/config";
import { buildAccountEmail } from "@/services/email/templates";
import { explainMailError, isEmailConfigured, sendMail } from "@/services/email/transport";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  if (auth.user.emailVerifiedAt) return Response.json({ ok: true, message: "Your email is already confirmed." });
  if (await isRateLimited(`resend:${auth.user.id}`, 3, 60 * 60 * 1000)) return jsonError("Please wait a while before asking again.", 429);

  const base = linkBase(request);
  if (!isEmailConfigured() || !base) return jsonError("Email is not set up on the server yet. Ask the person who runs this site.", 503);
  try {
    const token = await createAuthToken(auth.user.id, "VERIFY_EMAIL");
    const mail = buildAccountEmail("verify", `${base}/verify-email?token=${token}`, auth.user.name);
    await sendMail(auth.user.email, mail.subject, mail.text, mail.html);
  } catch (error) {
    return jsonError(explainMailError(error), 502);
  }
  return Response.json({ ok: true, message: `Sent. Check the inbox (and spam folder) of ${auth.user.email}.` });
}
