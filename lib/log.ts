// Error logging that is safe to keep: nothing secret or personal is written.
// Vercel only keeps runtime logs for about an hour, so unexpected errors are also saved in the database
// (table error_events, pruned after 30 days) where the owner can still see them tomorrow.
import { getDb } from "@/lib/db";

// Remove anything that looks like an email, a token, a connection string or a long number.
export function scrub(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[token]")
    .replace(/(token|password|secret|key|authorization)(["'\s:=]+)[^\s"',;]+/gi, "$1$2[hidden]")
    .replace(/\d{6,}/g, "#")
    .slice(0, 300);
}

export async function logError(scope: string, error: unknown, extra: { code?: string; path?: string } = {}): Promise<void> {
  const e = error as { name?: string; code?: unknown; message?: unknown };
  const code = extra.code ?? (typeof e?.code === "string" ? e.code : e?.name);
  const message = scrub(typeof e?.message === "string" ? e.message : String(error));
  const path = extra.path ? scrub(extra.path.split("?")[0]) : undefined;
  // One structured line for Vercel's log viewer.
  console.error(JSON.stringify({ level: "error", scope, code, message, path }));
  try {
    await getDb().errorEvent.create({ data: { scope: scope.slice(0, 60), code: code?.toString().slice(0, 60), message, path } });
  } catch {
    /* logging must never make things worse */
  }
}

export async function pruneOperationalData(): Promise<void> {
  const db = getDb();
  try {
    await db.errorEvent.deleteMany({ where: { at: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } });
    await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } });
  } catch {
    /* best effort */
  }
}
