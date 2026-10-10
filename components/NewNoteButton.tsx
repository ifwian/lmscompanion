"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Creates an (empty) note and opens it. Optional: link it to an e-GURO activity or to a course.
export default function NewNoteButton({ label = "New note", activityId, courseId, small = false }: { label?: string; activityId?: string; courseId?: string; small?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, courseId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not create the note.");
        setBusy(false);
        return;
      }
      router.push(`/notes/${result.id}`);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <span className="action">
      <button type="button" className={small ? "button button-quiet button-small" : "button"} onClick={create} disabled={busy}>
        {busy ? "Creating…" : label}
      </button>
      <span role="status" aria-live="polite" className="hint">{error}</span>
    </span>
  );
}
