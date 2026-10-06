import { getDb } from "@/lib/db";
import { clientKey, isRateLimited, isSameOrigin } from "@/lib/auth/request-guards";
import { createAuthToken } from "@/lib/auth/tokens";
import { normalizeEmail } from "@/lib/auth/validate";
import { linkBase } from "@/lib/config";
import { buildAccountEmail } from "@/services/email/templates";
import { isEmailConfigured, sendMail } from "@/services/email/transport";

export const dynamic = "force-dynamic";

// The answer is always the same, so nobody can use this form to find out which emails have an account.
const SAME_ANSWER = { ok: true, message: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (isRateLimited(`forgot:${clientKey(request)}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  if (typeof body?.email !== "string") return Response.json(SAME_ANSWER);

  const email = normalizeEmail(body.email);
  if (isRateLimited(`forgot-email:${email}`, 3, 60 * 60 * 1000)) return Response.json(SAME_ANSWER);

  const base = linkBase(request);
  if (!isEmailConfigured() || !base) return Response.json(SAME_ANSWER);
  const user = await getDb().user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (user) {
    try {
      const token = await createAuthToken(user.id, "RESET_PASSWORD");
      const mail = buildAccountEmail("reset", `${base}/reset-password?token=${token}`, user.name);
      await sendMail(user.email, mail.subject, mail.text, mail.html);
    } catch {
      /* same answer either way */
    }
  }
  return Response.json(SAME_ANSWER);
}
