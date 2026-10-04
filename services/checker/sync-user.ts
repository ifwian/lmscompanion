// Checks ONE student's e-GURO account. Used by the scheduled checker and by "Check now".
// Rules: one login attempt per check; a rejected login stops all further attempts until the student reconnects.
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { decryptSecret } from "@/lib/crypto";
import { connect, getActivities, getAnnouncements, LmsAuthError } from "@/services/lms";
import { detectAndSave } from "@/services/notifications/detect";
import { sendPendingEmails } from "@/services/email/send";

const STALE_CHECKING_MS = 10 * 60 * 1000; // a CHECKING state older than this is treated as a crashed run
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

export type SyncOutcome =
  | { ok: true; totalSeen: number; newCount: number; baseline: boolean; emailsSent: number }
  | { ok: false; code: string; skipped?: boolean };

export async function syncUserLms(userId: string): Promise<SyncOutcome> {
  const db = getDb();
  const connection = await db.lmsConnection.findUnique({ where: { userId } });
  if (!connection || !connection.encryptedPassword) return { ok: false, code: "NOT_CONNECTED", skipped: true };
  if (connection.status === "AUTH_ERROR") return { ok: false, code: "NEEDS_RECONNECT", skipped: true };

  // Claim: only one check per student at a time.
  const now = new Date();
  const claim = await db.lmsConnection.updateMany({
    where: {
      id: connection.id,
      OR: [{ status: { not: "CHECKING" } }, { checkingStartedAt: { lt: new Date(now.getTime() - STALE_CHECKING_MS) } }],
    },
    data: { status: "CHECKING", checkingStartedAt: now },
  });
  if (claim.count !== 1) return { ok: false, code: "ALREADY_CHECKING", skipped: true };

  const interval = config.checkIntervalMinutes() * 60 * 1000;

  try {
    const password = decryptSecret(connection.encryptedPassword);
    const session = await connect({ username: connection.lmsUsername, password });
    // Announcements are a separate source; empty until a verified endpoint exists.
    const items = [...(await getActivities(session)), ...(await getAnnouncements(session))];

    const baseline = !connection.baselineDone;
    const detected = await detectAndSave(userId, items, baseline);
    const emails = await sendPendingEmails(userId);

    await db.lmsConnection.update({
      where: { id: connection.id },
      data: {
        status: "CONNECTED",
        lastErrorCode: null,
        consecutiveFailures: 0,
        baselineDone: true,
        lastSuccessfulLogin: new Date(),
        lastCheckedAt: new Date(),
        nextCheckAt: new Date(Date.now() + interval),
        checkingStartedAt: null,
      },
    });
    return { ok: true, totalSeen: detected.totalSeen, newCount: detected.newCount, baseline, emailsSent: emails.sent };
  } catch (error) {
    const isAuth = error instanceof LmsAuthError;
    const code =
      (error as { code?: string }).code && typeof (error as { code?: string }).code === "string" &&
      ["AUTH_FAILED", "TEMPORARY", "FORMAT_CHANGED"].includes((error as { code: string }).code)
        ? (error as { code: string }).code
        : "INTERNAL";
    // Stored credentials we cannot decrypt (for example the key changed) need a reconnect too.
    const unreadable = code === "INTERNAL" && /encrypted|ENCRYPTION_KEY|Unsupported|auth/i.test(String((error as Error)?.message));
    const needsReconnect = isAuth || unreadable;
    const failures = connection.consecutiveFailures + 1;
    const backoff = Math.min(interval * 2 ** Math.min(failures, 8), MAX_BACKOFF_MS);

    await db.lmsConnection.update({
      where: { id: connection.id },
      data: {
        status: needsReconnect ? "AUTH_ERROR" : "TEMPORARY_ERROR",
        lastErrorCode: needsReconnect && !isAuth ? "CREDENTIALS_UNREADABLE" : code,
        consecutiveFailures: failures,
        lastCheckedAt: new Date(),
        nextCheckAt: needsReconnect ? null : new Date(Date.now() + backoff), // null = do not retry
        checkingStartedAt: null,
      },
    });
    return { ok: false, code: needsReconnect ? (isAuth ? "AUTH_FAILED" : "CREDENTIALS_UNREADABLE") : code };
  }
}
