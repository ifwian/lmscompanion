"use client";

import { useState } from "react";

export default function PasswordForm() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setBusy(true);
    const data = new FormData(form);
    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }),
      });
      const result = await response.json().catch(() => ({}));
      setIsError(!response.ok);
      setMessage(response.ok ? "Password changed. Other devices were signed out." : result.error ?? "Could not change password.");
      if (response.ok) form.reset();
    } catch {
      setIsError(true);
      setMessage("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <form className="form" method="post" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
        <p className="hint">At least 10 characters.</p>
      </div>
      <p className={isError ? "form-error" : "hint"} role="alert" aria-live="polite">{message}</p>
      <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}
