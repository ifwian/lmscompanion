"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIORITY_LABEL, TASK_LIMITS } from "@/lib/tasks";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null; // yyyy-mm-dd, or "" for no date
  priority: "LOW" | "NORMAL" | "HIGH";
};

// Create (taskId null) and edit, in one form so both behave the same way.
export default function TaskForm({ task, taskId }: { task?: Task; taskId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH">(task?.priority ?? "NORMAL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = { title, description, dueDate: dueDate || null, priority };
      const response = await fetch(taskId ? `/api/tasks/${taskId}` : "/api/tasks", {
        method: taskId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Could not save the task.");
        setBusy(false);
        return;
      }
      router.push("/tasks");
      router.refresh();
    } catch {
      setMessage("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <form className="task-form" onSubmit={save}>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TASK_LIMITS.titleMax} required autoFocus />
      </label>

      <label className="field">
        <span>Description <span className="hint">(optional)</span></span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={TASK_LIMITS.descriptionMax}
          placeholder="What needs doing, and anything you need to remember."
        />
      </label>

      <div className="task-form-row">
        <label className="field">
          <span>Due date <span className="hint">(optional)</span></span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH")}>
            {(["LOW", "NORMAL", "HIGH"] as const).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="note-bar-actions">
        <button type="submit" className="button button-small" disabled={busy}>
          {busy ? "Saving…" : taskId ? "Save changes" : "Add task"}
        </button>
        <button type="button" className="button button-quiet button-small" onClick={() => router.push("/tasks")} disabled={busy}>
          Cancel
        </button>
        <p className="form-error" role="status" aria-live="polite">{message}</p>
      </div>
    </form>
  );
}