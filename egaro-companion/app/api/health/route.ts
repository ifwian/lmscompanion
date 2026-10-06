import { getHealthReport } from "@/lib/health";

export const dynamic = "force-dynamic";

// GET /api/health -> JSON status. Safe to expose: contains no secrets.
export async function GET() {
  const report = await getHealthReport();
  const ok = report.database.state === "connected";
  return Response.json(report, { status: ok ? 200 : 503 });
}
