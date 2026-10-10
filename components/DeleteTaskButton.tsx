"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Delete is always confirmed: a task cannot be recovered once it is gone.
export default function DeleteTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) return;
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="button button-quiet button-small" onClick={remove} disabled={busy}>
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}