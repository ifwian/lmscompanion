"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// The Markdown renderer is only downloaded when someone opens the Preview tab.
const NoteMarkdown = dynamic(() => import("./NoteMarkdown"), { loading: () => <p className="hint">Loading preview…</p> });

type Props = {
  note: { id: string; title: string; body: string; tags: string[]; pinned: boolean; courseId: string | null; updatedAt: string; activityTitle: string | null };
  courses: { id: string; label: string }[];
  limits: { titleMax: number; bodyMax: number };
};

type Status = "saved" | "dirty" | "saving" | "error" | "conflict";

// Autosaves about one second after you stop typing, and when you leave the tab. Ctrl+S saves right away.
export default function NoteEditor({ note, courses, limits }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [courseId, setCourseId] = useState(note.courseId ?? "");
  const [pinned, setPinned] = useState(note.pinned);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<Status>("saved");
  const [message, setMessage] = useState("");

  const latest = useRef({ title, body, tags, courseId });
  latest.current = { title, body, tags, courseId };
  const version = useRef(note.updatedAt); // the updatedAt we last saw from the server
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);

  async function save(keepalive = false) {
    if (!dirty.current || saving.current) return;
    if (timer.current) clearTimeout(timer.current);
    saving.current = true;
    setStatus("saving");
    const current = latest.current;
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        keepalive,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: current.title, body: current.body, tags: current.tags, courseId: current.courseId || null, expectedUpdatedAt: version.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        version.current = result.updatedAt;
        // If the person typed more while saving, stay "dirty" and save again.
        const unchanged = latest.current.title === current.title && latest.current.body === current.body && latest.current.tags === current.tags && latest.current.courseId === current.courseId;
        dirty.current = !unchanged;
        setStatus(unchanged ? "saved" : "dirty");
        setMessage("");
        if (!unchanged) schedule();
      } else {
        setStatus(response.status === 409 ? "conflict" : "error");
        setMessage(result.error ?? "Could not save.");
      }
    } catch {
      setStatus("error");
      setMessage("Could not reach the server. Your text is still here; it will retry when you type again.");
    }
    saving.current = false;
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1000);
  }

  function changed() {
    dirty.current = true;
    setStatus("dirty");
    schedule();
  }

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void save(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    const response = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) version.current = result.updatedAt;
    else setPinned(!next);
  }

  async function remove() {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/notes");
      router.refresh();
    } else setMessage("Could not delete the note.");
  }

  const statusText = { saved: "Saved", dirty: "Unsaved changes…", saving: "Saving…", error: "Not saved", conflict: "Not saved" }[status];

  return (
    <div className="note-editor">
      <div className="note-bar">
        <button type="button" className="button button-quiet button-small" onClick={() => { void save(); router.push("/notes"); }}>← All notes</button>
        <span className={status === "error" || status === "conflict" ? "note-status is-error" : "note-status"} role="status" aria-live="polite">{statusText}</span>
        <span className="note-bar-actions">
          <button type="button" className="button button-quiet button-small" onClick={togglePin} aria-pressed={pinned}>{pinned ? "Unpin" : "Pin"}</button>
          <button type="button" className="button button-quiet button-small" onClick={remove}>Delete</button>
        </span>
      </div>

      {message && <p className="form-error" role="alert">{message}</p>}
      {status === "conflict" && <p><button type="button" className="button button-small" onClick={() => window.location.reload()}>Reload newest version</button></p>}

      <label className="visually-hidden" htmlFor="note-title">Title</label>
      <input id="note-title" className="note-title" type="text" value={title} maxLength={limits.titleMax} placeholder="Title"
        onChange={(e) => { setTitle(e.target.value); changed(); }} />

      {note.activityTitle && <p className="item-meta">About e-GURO item: {note.activityTitle}</p>}

      <div className="note-meta">
        <div className="field">
          <label htmlFor="note-course">Course</label>
          <select id="note-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); changed(); }}>
            <option value="">No course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="note-tags">Tags (comma separated)</label>
          <input id="note-tags" type="text" value={tags} placeholder="exam, week 3" onChange={(e) => { setTags(e.target.value); changed(); }} />
        </div>
      </div>

      <div className="note-tabs" role="tablist" aria-label="Note view">
        <button type="button" role="tab" aria-selected={mode === "edit"} className={mode === "edit" ? "filter is-active" : "filter"} onClick={() => setMode("edit")}>Write</button>
        <button type="button" role="tab" aria-selected={mode === "preview"} className={mode === "preview" ? "filter is-active" : "filter"} onClick={() => setMode("preview")}>Preview</button>
        <span className="hint note-count">{body.length.toLocaleString()} / {limits.bodyMax.toLocaleString()}</span>
      </div>

      {mode === "edit" ? (
        <>
          <label className="visually-hidden" htmlFor="note-body">Note text</label>
          <textarea id="note-body" className="note-body" value={body} maxLength={limits.bodyMax}
            placeholder={"Write here. You can use Markdown:\n# Heading\n- list item\n- [ ] to-do\n**bold**  `code`"}
            onChange={(e) => { setBody(e.target.value); changed(); }} onBlur={() => void save()} />
        </>
      ) : (
        <NoteMarkdown source={body} />
      )}
      <p className="hint">Notes are stored on this site&apos;s database. Do not keep passwords here. You can download all your notes from the Notes page.</p>
    </div>
  );
}
