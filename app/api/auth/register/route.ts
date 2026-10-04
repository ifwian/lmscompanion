import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { clientKey, isRateLimited, isSameOrigin } from "@/lib/auth/request-guards";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/lib/auth/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (isRateLimited(`register:${clientKey(request)}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const error = validateName(body.name) ?? validateEmail(body.email) ?? validatePassword(body.password);
  if (error) return Response.json({ error }, { status: 400 });

  const email = normalizeEmail(body.email as string);
  const db = getDb();

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return Response.json({ error: "An account with this email already exists. Try logging in." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      name: (body.name as string).trim(),
      email,
      passwordHash: await hashPassword(body.password as string),
      notificationPreferences: { create: {} }, // defaults: everything on except daily summary
    },
    select: { id: true, name: true, email: true },
  });

  await setSessionCookie(user.id);
  return Response.json({ user }, { status: 201 });
}
