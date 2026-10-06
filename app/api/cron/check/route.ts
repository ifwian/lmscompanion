import { timingSafeEqual } from "node:crypto";
import { runChecker } from "@/services/checker/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds (Vercel Hobby maximum). The checker also stops itself after ~240s.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // not configured = endpoint stays closed
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const summary = await runChecker();
  return Response.json({ ok: true, summary });
}

export const GET = handle;
export const POST = handle;
