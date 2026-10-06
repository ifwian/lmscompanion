// The scheduled job: finds students who are due for a check and checks them one by one.
// One student's failure never stops the others (each is wrapped in its own try/catch).
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { sendPendingEmails } from "@/services/email/send";
import { syncUserLms } from "./sync-user";

const MAX_RUN_MS = (Number.parseInt(process.env.MAX_RUN_SECONDS ?? "", 10) || 50) * 1000;
const STALE_CHECKING_MS = 10 * 60 * 1000;

export type CheckerSummary = { due: number; checked: number; ok: number; failed: number; skipped: number; emailsSent: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runChecker(): Promise<CheckerSummary> {
  const db = getDb();
  const started = Date.now();
  const now = new Date();
  const summary: CheckerSummary = { due: 0, checked: 0, ok: 0, failed: 0, skipped: 0, emailsSent: 0 };

  // Students who are due: connected (or retrying after a temporary error), password stored, next check time reached.
  // AUTH_ERROR and DISCONNECTED are never picked, so a changed password is never retried automatically.
  const due = await db.lmsConnection.findMany({
    where: {
      encryptedPassword: { not: null },
      AND: [
        {
          OR: [
            { status: { in: ["CONNECTED", "TEMPORARY_ERROR"] } },
            { status: "CHECKING", checkingStartedAt: { lt: new Date(now.getTime() - STALE_CHECKING_MS) } },
          ],
        },
        { OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] },
      ],
    },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: config.maxUsersPerRun(),
    select: { userId: true },
  });
  summary.due = due.length;

  for (const row of due) {
    if (Date.now() - started > MAX_RUN_MS) break; // leave the rest for the next run
    try {
      const outcome = await syncUserLms(row.userId);
      if (outcome.ok) {
        summary.ok += 1;
        summary.emailsSent += outcome.emailsSent;
      } else if (outcome.skipped) {
        summary.skipped += 1;
      } else {
        summary.failed += 1;
      }
      if (!("skipped" in outcome && outcome.skipped)) summary.checked += 1;
    } catch {
      summary.failed += 1; // unexpected error: count it, keep going
    }
    await sleep(config.delayBetweenUsersMs());
  }

  // Retry emails that failed earlier (only affects notifications with attempts left).
  const retried = await sendPendingEmails().catch(() => ({ sent: 0, skipped: 0, failed: 0 }));
  summary.emailsSent += retried.sent;
  return summary;
}
