// Telegram reminders for things that are due soon. Runs inside the checker, not on a request.
//
// Rules that keep this from becoming noise or a privacy problem:
//  - nothing is sent unless the student linked a chat AND turned reminders on;
//  - one message per student per run, never one message per item;
//  - a cooldown stops the same student being pinged again for hours;
//  - the query is scoped by the notification preference and the link, so only opted-in students are read.
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { logError } from "@/lib/log";
import { isTelegramConfigured, TELEGRAM_MAX_LINES, telegramDueSoonHours, telegramReminderCooldownHours } from "@/lib/telegram";
import { dueIn } from "@/lib/ui/format";
import { sendTelegramMessage } from "./send";

export type TelegramRunResult = { considered: number; sent: number; failed: number };

type Line = { label: string; when: string };

function buildMessage(lines: Line[], settingsUrl: string | null): string {
  const header = lines.length === 1 ? "1 thing is due soon:" : `${lines.length} things are due soon:`;
  const body = lines
    .slice(0, TELEGRAM_MAX_LINES)
    .map((line) => `• ${line.label} — ${line.when}`)
    .join("\n");
  const more = lines.length > TELEGRAM_MAX_LINES ? `\n…and ${lines.length - TELEGRAM_MAX_LINES} more.` : "";
  const footer = settingsUrl ? `\n\nManage reminders: ${settingsUrl}` : "";
  return `${header}\n\n${body}${more}${footer}`;
}

export async function sendDueReminders(): Promise<TelegramRunResult> {
  const result: TelegramRunResult = { considered: 0, sent: 0, failed: 0 };
  if (!isTelegramConfigured()) return result;

  const now = new Date();
  const horizon = new Date(now.getTime() + telegramDueSoonHours() * 60 * 60 * 1000);
  const cooldownMs = telegramReminderCooldownHours() * 60 * 60 * 1000;
  const db = getDb();

  try {
    // Only students who asked for this: preference on, a chat linked, and not inside their cooldown.
    const recipients = await db.telegramLink.findMany({
      // ownership: ok - a system reminder job; it only reaches students who linked a chat and opted in
      where: {
        user: { notificationPreferences: { telegramEnabled: true } },
        OR: [{ notificationsSentAt: null }, { notificationsSentAt: { lt: new Date(now.getTime() - cooldownMs) } }],
      },
      select: { userId: true, chatId: true },
      take: 200,
    });
    result.considered = recipients.length;
    if (recipients.length === 0) return result;

    for (const recipient of recipients) {
      const lines: Line[] = [];

      // The student's own unfinished tasks.
      // ownership: ok - filtered by this recipient's userId
      const tasks = await db.task.findMany({
        where: { userId: recipient.userId, status: "OPEN", dueDate: { not: null, lte: horizon, gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        orderBy: { dueDate: "asc" },
        take: TELEGRAM_MAX_LINES,
        select: { title: true, dueDate: true },
      });
      for (const task of tasks) lines.push({ label: task.title, when: dueIn(task.dueDate) });

      // e-GURO work that is still pending.
      // ownership: ok - filtered by this recipient's userId
      const activities = await db.activity.findMany({
        where: { userId: recipient.userId, lmsStatus: { not: null }, dueDate: { not: null, lte: horizon, gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        orderBy: { dueDate: "asc" },
        take: TELEGRAM_MAX_LINES,
        select: { title: true, dueDate: true, lmsType: true, course: { select: { courseCode: true } } },
      });
      for (const activity of activities) {
        const label = [activity.course?.courseCode, activity.title].filter(Boolean).join(" ");
        lines.push({ label, when: dueIn(activity.dueDate) });
      }

      if (lines.length === 0) continue;

      const settingsUrl = config.appUrl() ? `${config.appUrl()}/settings#telegram` : null;
      const sent = await sendTelegramMessage(recipient.chatId, buildMessage(lines, settingsUrl));
      if (sent.ok) {
        result.sent += 1;
        // ownership: ok - the recipient's own link row
        await db.telegramLink.updateMany({ where: { userId: recipient.userId }, data: { notificationsSentAt: new Date() } });
      } else {
        result.failed += 1;
      }
    }
  } catch (error) {
    // Never let a reminder problem disturb the check run itself.
    await logError("telegram-reminders", error, { code: "TELEGRAM_REMINDERS" });
  }
  return result;
}