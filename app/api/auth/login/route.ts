import { getDb } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { clientKey, isRateLimited, isSameOrigin } from "@/lib/auth/request-guards";
import { normalizeEmail } from "@/lib/auth/validate";

export const dynamic = "force-dynamic";

// Same message for "no such email" and "wrong password" so attackers learn nothing.
const BAD_LOGIN = { error: "Email or password is incorrect." };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (isRateLimited(`login:${clientKey(request)}`, 100, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return Response.json(BAD_LOGIN, { status: 401 });
  }

  // Per-account limit too: many classmates can share one campus IP, so the account is what we protect.
  const email = normalizeEmail(body.email);
  if (isRateLimited(`login-email:${email}`, 10, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const user = await getDb().user.findUnique({ where: { email } });
  // Always run one bcrypt comparison, even for unknown emails (see DUMMY_HASH).
  const passwordOk = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) return Response.json(BAD_LOGIN, { status: 401 });

  await setSessionCookie(user.id);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
}
