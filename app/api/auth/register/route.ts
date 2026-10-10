import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { clientKey, isRateLimited, isSameOrigin } from "@/lib/auth/request-guards";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/lib/auth/validate";
import { config, linkBase } from "@/lib/config";
import { createAuthToken } from "@/lib/auth/tokens";
import { buildAccountEmail } from "@/services/email/templates";
import { isEmailConfigured, sendMail } from "@/services/email/transport";
import { timingSafeEqual } from "node:crypto";

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a.trim().toLowerCase());
  const y = Buffer.from(b.trim().toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (await isRateLimited(`register:${clientKey(request)}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { name?: unknown; email?: unknown; password?: unknown; inviteCode?: unknown; acceptTerms?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Optional invite code: the owner shares it with classmates, so strangers cannot sign up.
  const invite = config.inviteCode();
  if (invite && !(typeof body.inviteCode === "string" && sameText(body.inviteCode, invite))) {
    return Response.json({ error: "That invite code is not correct. Ask whoever shared this site with you." }, { status: 403 });
  }
  if (body.acceptTerms !== true) {
    return Response.json({ error: "Please tick the box to agree to the privacy notice." }, { status: 400 });
  }

  const error = validateName(body.name) ?? validateEmail(body.email) ?? validatePassword(body.password);
  if (error) return Response.json({ error }, { status: 400 });

  const email = normalizeEmail(body.email as string);
  const db = getDb();

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return Response.json({ error: "An account with this email already exists. Try logging in." }, { status: 409 });
  }

  // Without email set up (local testing) nobody could ever confirm, so the address counts as confirmed.
  const emailReady = isEmailConfigured();
  const user = await db.user.create({
    data: {
      termsAcceptedAt: new Date(),
      emailVerifiedAt: emailReady ? null : new Date(),
      name: (body.name as string).trim(),
      email,
      passwordHash: await hashPassword(body.password as string),
      notificationPreferences: { create: {} }, // defaults: everything on except daily summary
    },
    select: { id: true, name: true, email: true },
  });

  // Ask them to confirm the address. A failure here must not stop the sign-up.
  const base = linkBase(request);
  if (emailReady && base) {
    try {
      const token = await createAuthToken(user.id, "VERIFY_EMAIL");
      const mail = buildAccountEmail("verify", `${base}/verify-email?token=${token}`, user.name);
      await sendMail(user.email, mail.subject, mail.text, mail.html);
    } catch {
      /* they can press "resend" later */
    }
  }

  await setSessionCookie(user.id);
  return Response.json({ user }, { status: 201 });
}
