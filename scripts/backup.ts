// Saves a copy of the important data to ONE encrypted file, so you can recover from a mistake or a lost database.
//   npm run backup                      -> backups/egaro-backup-YYYY-MM-DD.enc
// Uses DATABASE_URL and ENCRYPTION_KEY from .env. The file is compressed and encrypted with ENCRYPTION_KEY
// (AES-256-GCM), so it is safe to keep in a cloud drive. Without that key it cannot be opened, so keep the key
// somewhere else too. It contains: students, preferences, e-GURO connections (password still encrypted), courses,
// activities, notifications and notes. It does NOT contain temporary data (login links, rate limits, error log).
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { encryptSecret } from "../lib/crypto";
import { getDb } from "../lib/db";

async function main() {
  const db = getDb();
  /* ownership: ok-file - a backup copies every student's rows on purpose */
  const tables = {
    users: await db.user.findMany(),
    notificationPreferences: await db.notificationPreference.findMany(),
    lmsConnections: await db.lmsConnection.findMany(),
    courses: await db.course.findMany(),
    activities: await db.activity.findMany(),
    notifications: await db.notification.findMany(),
    notes: await db.note.findMany(),
  };
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  const payload = JSON.stringify({ format: "egaro-backup", version: 1, createdAt: new Date().toISOString(), counts, tables });
  const file = `backups/egaro-backup-${new Date().toISOString().slice(0, 10)}.enc`;
  mkdirSync("backups", { recursive: true });
  writeFileSync(file, encryptSecret(gzipSync(payload).toString("base64")));
  console.log(`Backup saved to ${file}`);
  console.log("Contains:", JSON.stringify(counts));
  console.log("Keep a copy somewhere other than this computer, and keep ENCRYPTION_KEY safe: without it the file cannot be opened.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Backup failed:", (error as Error).message);
  process.exit(1);
});
