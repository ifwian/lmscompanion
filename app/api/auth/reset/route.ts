import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { clientKey, isRateLimited, isSameOrigin } from "@/lib/auth/request-guards";
import { consumeAuthToken } from "@/lib/auth/tokens";
import { validatePassword } from "@/lib/auth/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (await isRateLimited(`reset:${clientKey(request)}`, 30, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown; newPassword?: unknown } | null;
  const problem = validatePassword(body?.newPassword);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const userId = await consumeAuthToken(typeof body?.token === "string" ? body.token : "", "RESET_PASSWORD");
  if (!userId) return Response.json({ error: "This link is not valid any more. Ask for a new reset link." }, { status: 400 });

  // passwordChangedAt signs out every old session (including a stolen one). Opening the emailed link also proves the address.
  await getDb().user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(body!.newPassword as string), passwordChangedAt: new Date(), emailVerifiedAt: new Date() },
  });
  return Response.json({ ok: true });
}
