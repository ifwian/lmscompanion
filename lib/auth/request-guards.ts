// Two small protections for the auth API routes: same-origin check (CSRF) and rate limiting.

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

// Simple in-memory rate limiter: max N attempts per window per key.
// LIMITATION: memory is per server instance, so on Vercel (many instances) this is only a
// best-effort brake. Milestone 12 (security review) revisits this.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "local";
}
