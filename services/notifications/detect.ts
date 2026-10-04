// Saves LMS items and decides which ones are NEW.
// Duplicate protection has two layers:
//   1. we look up existing fingerprints first, and
//   2. the database has UNIQUE(user_id, fingerprint), so even two checks running at once cannot insert twice.
import { getDb } from "@/lib/db";
import type { LmsActivity } from "@/services/lms";
import { fingerprintFor } from "./fingerprint";

export type DetectResult = { totalSeen: number; newCount: number; notificationsCreated: number };

export async function detectAndSave(userId: string, items: LmsActivity[], isBaseline: boolean): Promise<DetectResult> {
  const db = getDb();

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
    if (known.has(fingerprint)) continue;
    try {
      await db.$transaction(async (tx) => {
        const activity = await tx.activity.create({
          data: {
            userId,
            fingerprint,
            lmsActivityId: item.lmsActivityId,
            lmsType: item.lmsType,
            type: item.type,
            title: item.title,
            description: item.description,
            url: item.url,
            dueDate: item.dueDate,
          },
        });
        // The first sync is a silent baseline: remember everything, notify about nothing.
        if (!isBaseline) {
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

  return { totalSeen: byKey.size, newCount, notificationsCreated };
}
