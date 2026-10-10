import { jsonError, requireUserApi } from "@/lib/api";
import { isRateLimited } from "@/lib/auth/request-guards";
import { syncUserLms } from "@/services/checker/sync-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "Check now" button: checks only the logged-in student's own account.
export async function POST(request: Request) {
  const auth = await requireUserApi(request);
  if ("response" in auth) return auth.response;
  if (await isRateLimited(`check-now:${auth.user.id}`, 3, 10 * 60 * 1000)) {
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
      DATABASE_ERROR: "The app's database is missing an update. Run: npm run db:deploy, restart the app, then check again.",
      TEMPORARY: "Could not reach e-GURO right now. It will be retried automatically.",
    };
    return jsonError(messages[outcome.code] ?? "The check failed. It will be retried automatically.", 409);
  }
  const found = `Found ${outcome.pendingCount} pending and ${outcome.unreadCount} unread lesson${outcome.unreadCount === 1 ? "" : "s"}.`;
  const message = outcome.baseline
    ? `First check done. ${found} They were saved quietly, so no emails were sent for them.`
    : `Checked. ${found} ${outcome.newCount} new item${outcome.newCount === 1 ? "" : "s"}${outcome.emailsSent ? `, ${outcome.emailsSent} email${outcome.emailsSent === 1 ? "" : "s"} sent` : ""}.`;
  return Response.json({ ok: true, newCount: outcome.newCount, baseline: outcome.baseline, message });
}
