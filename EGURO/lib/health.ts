// Collects the facts shown on /status. Never returns secrets, only yes/no and short messages.
import { getDb } from "./db";

export type HealthReport = {
  app: "ok";
  checkedAt: string;
  database: { state: "connected" | "not-configured" | "error"; message: string };
  updates: { state: "up-to-date" | "missing" | "unknown"; message: string };
  env: { name: string; set: boolean }[];
};

// Only these names are checked. Values are never read out, only "is it set?".
const REQUIRED_ENV = ["DATABASE_URL", "AUTH_SECRET", "LMS_BASE_URL"];

export async function getHealthReport(): Promise<HealthReport> {
  const env = REQUIRED_ENV.map((name) => ({ name, set: Boolean(process.env[name]) }));
  let database: HealthReport["database"];

  if (!process.env.DATABASE_URL) {
    database = { state: "not-configured", message: "DATABASE_URL is not set." };
  } else {
    try {
      await getDb().$queryRaw`SELECT 1`;
      database = { state: "connected", message: "Query succeeded." };
    } catch {
      // Do not print the raw error: it can contain the connection string.
      database = { state: "error", message: "Could not connect. Check DATABASE_URL and that the database is running." };
    }
  }

  let updates: HealthReport["updates"] = { state: "unknown", message: "Not checked." };
  if (database.state === "connected") {
    try {
      const rows = await getDb().$queryRaw<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'last_seen_at'`;
      updates = rows.length > 0
        ? { state: "up-to-date", message: "All database updates are applied." }
        : { state: "missing", message: "A database update is missing. Run: npm run db:deploy" };
    } catch {
      updates = { state: "unknown", message: "Could not check." };
    }
  }

  return { app: "ok", checkedAt: new Date().toISOString(), database, updates, env };
}
