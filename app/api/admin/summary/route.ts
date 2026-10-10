import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { getState } from "@/lib/system";

// ownership: ok-file - counts across all students on purpose; returns no personal data
export const dynamic = "force-dynamic";

// For the person who runs the site: how many students, and how healthy are their connections?
// Protected by CRON_SECRET. It returns COUNTS ONLY: no names, emails, usernames or passwords.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  // (ownership: ok-file - this owner summary counts across all students on purpose: counts only, no personal data)
  const [users, verified, byStatus, noConnection, pendingEmails, failedEmails, newest, oldest, errors24h, recent, lastRun, lastSummary] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { emailVerifiedAt: { not: null } } }),
    db.lmsConnection.groupBy({ by: ["status"], _count: true }),
    db.user.count({ where: { lmsConnection: null } }),
    db.notification.count({ where: { emailStatus: "PENDING" } }),
    db.notification.count({ where: { emailStatus: "FAILED" } }),
    db.lmsConnection.aggregate({ _max: { lastCheckedAt: true } }),
    db.lmsConnection.aggregate({ _min: { lastCheckedAt: true }, where: { status: { in: ["CONNECTED", "TEMPORARY_ERROR"] } } }),
    db.errorEvent.count({ where: { at: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    db.errorEvent.findMany({ orderBy: { at: "desc" }, take: 10, select: { at: true, scope: true, code: true, message: true, path: true } }),
    getState("checker_last_run"),
    getState("checker_last_summary"),
  ]);
  const minutesAgo = (d: Date | null) => (d ? Math.round((Date.now() - d.getTime()) / 60000) : null);
  return Response.json({
    users,
    verifiedEmails: verified,
    studentsWithoutConnection: noConnection,
    connections: Object.fromEntries(byStatus.map((row) => [row.status, row._count])),
    emails: { pending: pendingEmails, failed: failedEmails },
    lastCheckMinutesAgo: minutesAgo(newest._max.lastCheckedAt),
    oldestActiveCheckMinutesAgo: minutesAgo(oldest._min.lastCheckedAt),
    checker: { lastRunMinutesAgo: lastRun ? minutesAgo(new Date(lastRun.value)) : null, lastSummary: lastSummary ? JSON.parse(lastSummary.value) : null },
    errors: { last24h: errors24h, recent }, // scrubbed: no emails, tokens, passwords or database addresses
  });
}
