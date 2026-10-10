// Small facts about the system (for example "when did the checker last run?").
import { getDb } from "@/lib/db";

export async function setState(key: string, value: string): Promise<void> {
  try {
    await getDb().systemState.upsert({ where: { key }, update: { value }, create: { key, value } });
  } catch {
    /* best effort */
  }
}

export async function getState(key: string): Promise<{ value: string; updatedAt: Date } | null> {
  try {
    return await getDb().systemState.findUnique({ where: { key } });
  } catch {
    return null;
  }
}
