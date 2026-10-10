import { getDb } from "@/lib/db";
import { envProblems } from "@/lib/env";
import { getHealthReport } from "@/lib/health";
import { getState } from "@/lib/system";

export const dynamic = "force-dynamic";

const STALE_AFTER_MINUTES = 30;

// GET /api/health        -> is the app up and is the database reachable? (200 or 503)
// GET /api/health?strict=1 -> also fails (503) if settings are missing or the checker has stopped running.
// Point a free uptime monitor (for example UptimeRobot) at the strict address and it emails you when something breaks.
// Safe to expose: it contains no secrets, no names and no emails.
export async function GET(request: Request) {
  const report = await getHealthReport();
  const strict = new URL(request.url).searchParams.get("strict") === "1";
  const databaseOk = report.database.state === "connected";
  if (!strict) return Response.json(report, { status: databaseOk ? 200 : 503 });

  let checker = { lastRunMinutesAgo: null as number | null, activeStudents: 0, stale: false };
  if (databaseOk) {
    const [last, active] = await Promise.all([
      getState("checker_last_run"),
      getDb().lmsConnection.count({ where: { encryptedPassword: { not: null }, status: { in: ["CONNECTED", "TEMPORARY_ERROR", "CHECKING"] } } }), // ownership: ok - counts only
    ]);
    const minutes = last ? Math.round((Date.now() - new Date(last.value).getTime()) / 60000) : null;
    checker = { lastRunMinutesAgo: minutes, activeStudents: active, stale: active > 0 && (minutes === null || minutes > STALE_AFTER_MINUTES) };
  }
  const problems = envProblems().filter((p) => !p.startsWith("Email is not fully set up") || process.env.NODE_ENV === "production");
  const ok = databaseOk && !checker.stale && problems.length === 0;
  return Response.json({ ...report, strict: true, checker, settingsProblems: problems }, { status: ok ? 200 : 503 });
}
