// Collects the facts shown on /status. Never returns secrets, only yes/no and short messages.
import { getDb } from "./db";

export type HealthReport = {
  app: "ok";
  checkedAt: string;
  database: { state: "connected" | "not-configured" | "error"; message: string };
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

  return { app: "ok", checkedAt: new Date().toISOString(), database, env };
}
