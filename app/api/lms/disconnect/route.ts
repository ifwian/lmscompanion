import { getDb } from "@/lib/db";
import { requireUserApi } from "@/lib/api";

export const dynamic = "force-dynamic";

// Removes the stored LMS password. Saved activities and notifications are kept.
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  await getDb().lmsConnection.updateMany({
    where: { userId: auth.user.id },
    data: { encryptedPassword: null, status: "DISCONNECTED", nextCheckAt: null, lastErrorCode: null },
  });
  return Response.json({ ok: true });
}
