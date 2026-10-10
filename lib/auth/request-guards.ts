// Two small protections for the API routes: same-origin check (CSRF) and rate limiting.
import { getDb } from "@/lib/db";


// CSRF defence: browsers send an Origin header on POST requests. If it is present and does not
// match this site, the request came from another website, so we reject it.
// (The session cookie is also SameSite=Lax, which blocks most cross-site requests already.)
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // browsers always send Origin on form/fetch POSTs
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Rate limiter stored in the database, so every server instance shares the same counters
// (an in-memory counter would reset on each serverless instance and be easy to get around).
// One atomic statement: start a new window if the old one ended, otherwise add one.
// If the database cannot be reached we let the request through (and log it): a broken limiter must not lock everyone out.
export async function isRateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const rows = await getDb().$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits ("key", "count", "reset_at")
      VALUES (${key}, 1, (now() AT TIME ZONE 'utc') + (${windowMs}::int * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN rate_limits.reset_at < (now() AT TIME ZONE 'utc') THEN 1 ELSE rate_limits.count + 1 END,
        "reset_at" = CASE WHEN rate_limits.reset_at < (now() AT TIME ZONE 'utc') THEN (now() AT TIME ZONE 'utc') + (${windowMs}::int * interval '1 millisecond') ELSE rate_limits.reset_at END
      RETURNING "count"`;
    return Number(rows[0]?.count ?? 0) > max;
  } catch {
    console.error(JSON.stringify({ level: "error", scope: "rate-limit", message: "Rate limiter unavailable; letting the request through." }));
    return false;
  }
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "local";
}
