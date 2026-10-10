// The scheduled job: finds students who are due for a check and checks them one by one.
// One student's failure never stops the others (each is wrapped in its own try/catch).
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { sendPendingEmails } from "@/services/email/send";
import { ALERT_FOOTER, sendOwnerAlert } from "@/services/email/owner-alert";
import { pruneLinkCodes } from "@/services/telegram/send";
import { sendDueReminders } from "@/services/telegram/reminders";
import { pruneOperationalData } from "@/lib/log";
import { setState } from "@/lib/system";
import { syncUserLms } from "./sync-user";

const MAX_RUN_MS = (Number.parseInt(process.env.MAX_RUN_SECONDS ?? "", 10) || 240) * 1000; // Vercel Hobby allows up to 300 s
const STALE_CHECKING_MS = 10 * 60 * 1000;

export type CheckerSummary = { due: number; checked: number; ok: number; failed: number; skipped: number; emailsSent: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Alerts for the person who runs the site. Both triggers are about THIS ONE run, never about one student:
//  - many checks failed at once (usually the network or e-GURO is down, not the students);
//  - e-GURO answered in a shape the parsers do not recognise (the site changed and the code needs an update).
// Every value is scrubbed before it is emailed, so no address, token or password can leave the server.
async function alertOwner(summary: CheckerSummary, failureCodes: Map<string, number>): Promise<void> {
  if (summary.failed === 0) return;
  const byCode = [...failureCodes.entries()].sort((a, b) => b[1] - a[1]).map(([code, count]) => `${code} (${count})`).join(", ");
  const runRows: [string, string][] = [
    ["Run finished", new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })],
    ["Students checked", String(summary.checked)],
    ["Students failed", String(summary.failed)],
    ["Failure codes", byCode],
  ];

  if (summary.failed >= config.ownerAlertFailureThreshold()) {
    await sendOwnerAlert({
      kind: "checker",
      subject: `[ e-GURO ] ${summary.failed} student checks failed in one run`,
      kicker: "Automated alert",
      title: `${summary.failed} of ${summary.checked} student checks failed`,
      details: runRows,
      footer: ALERT_FOOTER,
    });
  }

  // A changed e-GURO page is the one failure the students cannot fix, so it always gets its own alert.
  const formatFailures = failureCodes.get("FORMAT_CHANGED") ?? 0;
  if (formatFailures >= config.ownerAlertFormatThreshold()) {
    await sendOwnerAlert({
      kind: "parser",
      subject: `[ e-GURO ] e-GURO changed its page layout (${formatFailures} in one run)`,
      kicker: "Automated alert",
      title: "e-GURO answered in a layout this app does not recognise",
      details: [
        ...runRows,
        ["Layout errors", String(formatFailures)],
        ["Likely cause", "e-GURO changed one of its pages or endpoints, so the parser no longer recognises the answer."],
        ["Students affected", "Their last known data is kept; new work is not being collected until this is fixed."],
        ["What to do", "Run: npm run lms:diagnose, then npm run test:parsers, then update services/lms/client.ts and services/lms/parsers.ts."],
      ],
      footer: ALERT_FOOTER,
    });
  }
}

export async function runChecker(): Promise<CheckerSummary> {
  const db = getDb();
  const started = Date.now();
  const now = new Date();
  const summary: CheckerSummary = { due: 0, checked: 0, ok: 0, failed: 0, skipped: 0, emailsSent: 0 };
  await setState("checker_last_run", now.toISOString()); // heartbeat: lets /api/health?strict=1 notice if checking stops

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

  // A few students at a time (CHECK_CONCURRENCY, default 3), with a short pause between groups.
  // One student's failure never stops the others: each is wrapped in its own try/catch.
  const group = config.checkConcurrency();
  const failureCodes = new Map<string, number>();
  const recordFailure = (code: string) => failureCodes.set(code, (failureCodes.get(code) ?? 0) + 1);
  for (let i = 0; i < due.length; i += group) {
    if (Date.now() - started > MAX_RUN_MS) break; // leave the rest for the next run
    await Promise.all(
      due.slice(i, i + group).map(async (row) => {
        try {
          const outcome = await syncUserLms(row.userId);
          if (outcome.ok) {
            summary.ok += 1;
            summary.emailsSent += outcome.emailsSent;
          } else if (outcome.skipped) {
            summary.skipped += 1;
          } else {
            summary.failed += 1;
            recordFailure(outcome.code); // a short code only: never a message from e-GURO
          }
          if (!("skipped" in outcome && outcome.skipped)) summary.checked += 1;
        } catch {
          summary.failed += 1; // unexpected error: count it, keep going
          recordFailure("UNEXPECTED");
        }
      }),
    );
    await sleep(config.delayBetweenUsersMs());
  }

  // Retry emails that failed earlier (only affects notifications with attempts left).
  const retried = await sendPendingEmails().catch(() => ({ sent: 0, skipped: 0, failed: 0 }));
  summary.emailsSent += retried.sent;
  // Telegram reminders go out after the checks, so a due date found in this run is included.
  const telegram = await sendDueReminders();
  await pruneLinkCodes();
  await alertOwner(summary, failureCodes);
  await setState("checker_last_summary", JSON.stringify({ ...summary, seconds: Math.round((Date.now() - started) / 1000), telegramRemindersSent: telegram.sent }));
  await pruneOperationalData();
  return summary;
}
