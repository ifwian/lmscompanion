// Puts a backup back into an EMPTY database.
//   1. Create a fresh database and run:  npm run db:deploy      (with DATABASE_URL pointing at it)
//   2. Run:                              npm run restore -- backups/egaro-backup-YYYY-MM-DD.enc
// It refuses to run if the database already has students, so it can never overwrite live data.
// It needs the SAME ENCRYPTION_KEY that made the backup (also needed for the stored e-GURO passwords to work).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { decryptSecret } from "../lib/crypto";
import { getDb } from "../lib/db";

// JSON turns dates into text; turn the known date columns back into dates.
const DATE_FIELDS = new Set(["createdAt", "updatedAt", "passwordChangedAt", "termsAcceptedAt", "emailVerifiedAt", "lastSuccessfulLogin", "lastCheckedAt", "nextCheckAt", "checkingStartedAt", "dueDate", "postedAt", "detectedAt", "lastSeenAt", "emailSentAt", "readAt"]);
function revive<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, DATE_FIELDS.has(k) && typeof v === "string" ? new Date(v) : v])) as T);
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Give the backup file: npm run restore -- backups/egaro-backup-YYYY-MM-DD.enc");
  const db = getDb();
  /* ownership: ok-file - a restore writes every student's rows on purpose */
  if ((await db.user.count()) > 0) throw new Error("This database already has students. Restore only into a new, empty database.");

  let data: { format?: string; version?: number; counts: Record<string, number>; tables: Record<string, Record<string, unknown>[]> };
  try {
    data = JSON.parse(gunzipSync(Buffer.from(decryptSecret(readFileSync(file, "utf8").trim()), "base64")).toString("utf8"));
  } catch {
    throw new Error("Could not open the backup. Wrong file, damaged file, or a different ENCRYPTION_KEY than the one that made it.");
  }
  if (data.format !== "egaro-backup" || data.version !== 1) throw new Error("This is not a backup file this version understands.");

  const t = data.tables;
  // Order matters: parents before the rows that point to them.
  await db.user.createMany({ data: revive(t.users) as never });
  await db.notificationPreference.createMany({ data: revive(t.notificationPreferences) as never });
  await db.lmsConnection.createMany({ data: revive(t.lmsConnections) as never });
  await db.course.createMany({ data: revive(t.courses) as never });
  await db.activity.createMany({ data: revive(t.activities) as never });
  await db.notification.createMany({ data: revive(t.notifications) as never });
  await db.note.createMany({ data: revive(t.notes) as never });

  const restored = { users: await db.user.count(), activities: await db.activity.count(), notes: await db.note.count() };
  console.log("Restored. Backup said:", JSON.stringify(data.counts));
  console.log("Database now has:", JSON.stringify(restored));
  process.exit(0);
}

main().catch((error) => {
  console.error("Restore failed:", (error as Error).message);
  process.exit(1);
});
