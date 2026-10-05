import { clearSessionCookie } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/auth/request-guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  await clearSessionCookie();
  return Response.json({ ok: true });
}
