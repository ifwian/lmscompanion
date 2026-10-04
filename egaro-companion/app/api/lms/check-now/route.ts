import { jsonError, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { syncUserLms } from "@/services/checker/sync-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Check now" button: checks only the logged-in student's own account.
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  if (isRateLimited(`check-now:${auth.user.id}`, 3, 10 * 60 * 1000)) {
    return jsonError("Please wait a few minutes before checking again.", 429);
  }
  const outcome = await syncUserLms(auth.user.id);
  if (!outcome.ok) {
    const messages: Record<string, string> = {
      NOT_CONNECTED: "Connect your e-GURO account first.",
      NEEDS_RECONNECT: "Your e-GURO connection needs to be updated. Reconnect in Settings.",
      ALREADY_CHECKING: "A check is already running.",
      AUTH_FAILED: "Your e-GURO connection needs to be updated. Reconnect in Settings.",
      CREDENTIALS_UNREADABLE: "Your e-GURO connection needs to be updated. Reconnect in Settings.",
      FORMAT_CHANGED: "e-GURO responded in a way this app does not understand yet.",
      TEMPORARY: "Could not reach e-GURO right now. It will be retried automatically.",
    };
    return jsonError(messages[outcome.code] ?? "The check failed. It will be retried automatically.", 409);
  }
  return Response.json({ ok: true, newCount: outcome.newCount, baseline: outcome.baseline });
}
