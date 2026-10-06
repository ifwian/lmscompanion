"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A button that POSTs to one of our API routes, then refreshes the page data.
// Used for: mark as read, mark all as read, check now, disconnect.
export default function ActionButton({
  url,
  label,
  busyLabel,
  quiet = true,
  confirmText,
}: {
  url: string;
  label: string;
  busyLabel?: string;
  quiet?: boolean;
  confirmText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(result.error ?? "Something went wrong.");
      else if (result.message) setMessage(result.message);
      router.refresh(); // always refresh: a failed check changes the connection status shown on the page
    } catch {
      setMessage("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <span className="action">
      <button type="button" className={quiet ? "button button-quiet button-small" : "button button-small"} onClick={run} disabled={busy}>
        {busy ? busyLabel ?? "Please wait…" : label}
      </button>
      <span role="status" aria-live="polite" className="hint">{message}</span>
    </span>
  );
}
