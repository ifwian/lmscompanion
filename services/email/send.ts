// Sends the emails for notifications that are waiting. Safe to run many times:
// a notification is only ever emailed while it is PENDING (or FAILED with attempts left).
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { isTypeEnabled } from "@/services/notifications/preferences";
import { buildEmail } from "./templates";
import { isEmailConfigured, sendMail } from "./transport";

const MAX_ATTEMPTS = 3;
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // older than this and still unsent: skip it, so fixing email later does not send a flood

export type EmailRunResult = { sent: number; skipped: number; failed: number };

export async function sendPendingEmails(userId?: string): Promise<EmailRunResult> {
  const result: EmailRunResult = { sent: 0, skipped: 0, failed: 0 };
  const db = getDb();

  const pending = await db.notification.findMany({
    where: {
      ...(userId ? { userId } : {}),
      OR: [{ emailStatus: "PENDING" }, { emailStatus: "FAILED", emailAttempts: { lt: MAX_ATTEMPTS } }],
    },
    include: {
      activity: { include: { course: true } },
      user: { select: { email: true, emailVerifiedAt: true, notificationPreferences: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  for (const note of pending) {
    if (Date.now() - note.createdAt.getTime() > STALE_AFTER_MS) {
      await db.notification.update({ where: { id: note.id }, data: { emailStatus: "SKIPPED" } });
      result.skipped += 1;
      continue;
    }
    // The student turned this type off: keep the in-app notification, skip the email.
    if (!isTypeEnabled(note.user.notificationPreferences, note.notificationType)) {
      await db.notification.update({ where: { id: note.id }, data: { emailStatus: "SKIPPED" } });
      result.skipped += 1;
      continue;
    }
    if (!isEmailConfigured()) continue; // leave it PENDING until email is configured
    if (!note.user.emailVerifiedAt) continue; // never email an address that has not been confirmed (it stays pending)

    // Claim it: only one runner can move this exact (status, attempts) pair forward.
    const claimed = await db.notification.updateMany({
      where: { id: note.id, emailStatus: note.emailStatus, emailAttempts: note.emailAttempts },
      data: { emailAttempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    const course = note.activity.course;
    const email = buildEmail(
      {
        type: note.notificationType,
        lmsType: note.activity.lmsType,
        title: note.activity.title,
        courseLabel: course ? [course.courseCode, course.courseName].filter(Boolean).join(" ") : null,
        postedAt: note.activity.postedAt,
        detectedAt: note.activity.detectedAt,
        dueDate: note.activity.dueDate,
        url: note.activity.url,
      },
      config.lmsBaseUrl(),
      config.appUrl() ? `${config.appUrl()}/settings` : null,
    );

    try {
      await sendMail(note.user.email, email.subject, email.text, email.html);
      await db.notification.update({ where: { id: note.id }, data: { emailStatus: "SENT", emailSentAt: new Date() } });
      result.sent += 1;
    } catch {
      // Do not log the error object: SMTP errors can contain addresses or credentials.
      await db.notification.update({ where: { id: note.id }, data: { emailStatus: "FAILED" } });
      result.failed += 1;
    }
  }
  return result;
}
