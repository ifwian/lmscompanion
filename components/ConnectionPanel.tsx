import Link from "next/link";
import type { LmsConnection } from "../generated/prisma/client";
import { STATUS_LABEL, formatDateTime, timeAgo } from "@/lib/ui/format";

function attentionText(connection: LmsConnection): string | null {
  switch (connection.status) {
    case "AUTH_ERROR":
      return "Your e-GURO connection needs to be updated.";
    case "DISCONNECTED":
      return "Not connected.";
    case "TEMPORARY_ERROR":
      return connection.lastErrorCode === "FORMAT_CHANGED"
        ? "e-GURO responded in a way this app does not understand yet. The app's e-GURO code needs an update; see MANUAL_STEPS.md."
        : "e-GURO could not be reached. It will be retried automatically.";
    default:
      return null;
  }
}

export default function ConnectionPanel({ connection }: { connection: LmsConnection | null }) {
  if (!connection) {
    return (
      <section className="panel" aria-labelledby="conn-title">
        <h2 id="conn-title" className="label">LMS connection</h2>
        <p className="state-line"><span className="dot dot-NONE" aria-hidden="true" />Not connected</p>
        <p className="hint">Connect your CCC e-GURO account to monitor new LMS activity.</p>
        <p><Link href="/settings#lms">Connect e-GURO</Link></p>
      </section>
    );
  }
  const attention = attentionText(connection);
  return (
    <section className="panel" aria-labelledby="conn-title">
      <h2 id="conn-title" className="label">LMS connection</h2>
      <p className="state-line"><span className={`dot dot-${connection.status}`} aria-hidden="true" />{STATUS_LABEL[connection.status]}</p>
      {attention && <p className="hint">{attention}</p>}
      <dl className="meta-list">
        <div><dt>Last checked</dt><dd>{timeAgo(connection.lastCheckedAt)}</dd></div>
        <div><dt>Last successful login</dt><dd>{connection.lastSuccessfulLogin ? formatDateTime(connection.lastSuccessfulLogin) : "Never"}</dd></div>
      </dl>
      {(connection.status === "AUTH_ERROR" || connection.status === "DISCONNECTED") && (
        <p><Link href="/settings#lms">Reconnect e-GURO</Link></p>
      )}
    </section>
  );
}
