"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The checkbox on each task row: flips between OPEN and DONE.
export default function TaskToggle({ taskId, done }: { taskId: string; done: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: done ? "OPEN" : "DONE" }),
      });
      if (!response.ok) return;
      router.refresh(); // the list is server-rendered, so re-read it
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`task-check${done ? " is-done" : ""}`}>
      <input type="checkbox" checked={done} onChange={toggle} disabled={busy} />
      <span className="visually-hidden">{done ? "Mark as not done" : "Mark as done"}</span>
    </label>
  );
}