"use client";

import { useState } from "react";

type Prefs = { activitiesEnabled: boolean; quizzesEnabled: boolean; assignmentsEnabled: boolean; announcementsEnabled: boolean };

const ROWS: { key: keyof Prefs; label: string }[] = [
  { key: "activitiesEnabled", label: "New activities" },
  { key: "quizzesEnabled", label: "New quizzes" },
  { key: "assignmentsEnabled", label: "New assignments" },
  { key: "announcementsEnabled", label: "Announcements" },
];

// Each switch saves immediately.
export default function PreferencesForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [message, setMessage] = useState("");

  async function toggle(key: keyof Prefs, value: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setMessage("");
    try {
      const response = await fetch("/api/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error();
      setMessage("Saved.");
    } catch {
      setPrefs(previous);
      setMessage("Could not save. Try again.");
    }
  }

  return (
    <fieldset className="prefs">
      <legend className="visually-hidden">Email notification types</legend>
      {ROWS.map((row) => (
        <label key={row.key} className="pref-row">
          <span>{row.label}</span>
          <input type="checkbox" checked={prefs[row.key]} onChange={(e) => toggle(row.key, e.target.checked)} />
          <span className="pref-state">{prefs[row.key] ? "On" : "Off"}</span>
        </label>
      ))}
      <label className="pref-row is-disabled">
        <span>Daily summary</span>
        <input type="checkbox" checked={false} disabled />
        <span className="pref-state">Not available yet</span>
      </label>
      <p className="hint" role="status" aria-live="polite">{message}</p>
    </fieldset>
  );
}
