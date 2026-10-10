import { getDb } from "@/lib/db";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { clientKey, isRateLimited, isSameOrigin } from "@/lib/auth/request-guards";

export const dynamic = "force-dynamic";

// The page asks the person to press a button, which calls this. (A plain link would be "used up" by email
// scanners that open links automatically.)
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (await isRateLimited(`verify:${clientKey(request)}`, 30, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const userId = await consumeAuthToken(typeof body?.token === "string" ? body.token : "", "VERIFY_EMAIL");
  if (!userId) return Response.json({ error: "This link is not valid any more. Log in and ask for a new one." }, { status: 400 });
  await getDb().user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return Response.json({ ok: true });
}
