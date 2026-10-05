// Saves LMS items, keeps their CURRENT state (pending / unread) up to date, and decides which ones are NEW.
// Duplicate protection has two layers:
//   1. we look up existing fingerprints first, and
//   2. the database has UNIQUE(user_id, fingerprint), so even two checks running at once cannot insert twice.
import { getDb } from "@/lib/db";
import type { LmsActivity } from "@/services/lms";
import { fingerprintFor } from "./fingerprint";

export type DetectResult = {
  totalSeen: number;
  newCount: number;
  notificationsCreated: number;
  pendingCount: number;
  unreadCount: number;
};

export async function detectAndSave(
  userId: string,
  items: LmsActivity[],
  isBaseline: boolean,
  courseIdByLmsId: Map<string, string> = new Map(),
): Promise<DetectResult> {
  const db = getDb();
  const startedAt = new Date();

  // Remove duplicates inside this batch.
  const byKey = new Map<string, LmsActivity>();
  for (const item of items) byKey.set(fingerprintFor(item), item);

  const existing = await db.activity.findMany({
    where: { userId, fingerprint: { in: [...byKey.keys()] } },
    select: { fingerprint: true },
  });
  const known = new Set(existing.map((row) => row.fingerprint));

  let newCount = 0;
  let notificationsCreated = 0;

  for (const [fingerprint, item] of byKey) {
    const courseId = item.lmsCourseId ? courseIdByLmsId.get(item.lmsCourseId) ?? null : null;
    const state = {
      lmsStatus: item.status,
      isUnread: item.unread,
      isMaterial: item.isMaterial,
      lastSeenAt: new Date(),
    };

    if (known.has(fingerprint)) {
      // Already saved: refresh its current state and details. Never creates a notification.
      await db.activity.updateMany({
        where: { userId, fingerprint },
        data: { ...state, title: item.title, dueDate: item.dueDate, postedAt: item.postedAt, ...(item.url ? { url: item.url } : {}) },
      });
      if (courseId) await db.activity.updateMany({ where: { userId, fingerprint, courseId: null }, data: { courseId } });
      continue;
    }

    try {
      await db.$transaction(async (tx) => {
        const activity = await tx.activity.create({
          data: {
            userId,
            courseId,
            fingerprint,
            lmsActivityId: item.lmsActivityId,
            lmsType: item.lmsType,
            type: item.type,
            title: item.title,
            description: item.description,
            url: item.url,
            dueDate: item.dueDate,
            postedAt: item.postedAt,
            ...state,
          },
        });
        // The first sync is a silent baseline: remember everything, notify about nothing.
        // Reading material (lessons) never sends a notification: only work to do does.
        if (!isBaseline && !item.isMaterial) {
          await tx.notification.create({ data: { userId, activityId: activity.id, notificationType: item.type } });
          notificationsCreated += 1;
        }
      });
      newCount += 1;
    } catch (error) {
      // P2002 = unique constraint: another check saved it first. That is fine, skip it.
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }

  // Items that were pending or unread before but are no longer in any list (handed in, or opened): clear the flags.
  await db.activity.updateMany({
    where: { userId, lastSeenAt: { lt: startedAt }, OR: [{ lmsStatus: { not: null } }, { isUnread: true }] },
    data: { lmsStatus: null, isUnread: false },
  });

  const all = [...byKey.values()];
  return {
    totalSeen: byKey.size,
    newCount,
    notificationsCreated,
    pendingCount: all.filter((i) => i.status).length,
    unreadCount: all.filter((i) => i.unread && !i.status).length,
  };
}
