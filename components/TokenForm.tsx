"use client";

import { useState } from "react";
import Link from "next/link";

// One small form used by three pages:
//  - "confirm"  : a button that confirms the email address from the emailed link
//  - "forgot"   : asks for an email address and requests a reset link
//  - "reset"    : sets a new password using the emailed link
export default function TokenForm({ mode, token }: { mode: "confirm" | "forgot" | "reset"; token?: string }) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      setIsError(!response.ok);
      setMessage(result.message ?? result.error ?? (response.ok ? "Done." : "Something went wrong."));
      if (response.ok) setDone(true);
    } catch {
      setIsError(true);
      setMessage("Could not reach the server.");
    }
    setBusy(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (mode === "confirm") await post("/api/auth/verify", { token });
    if (mode === "forgot") await post("/api/auth/forgot", { email: data.get("email") });
    if (mode === "reset") await post("/api/auth/reset", { token, newPassword: data.get("newPassword") });
  }

  return (
    <form className="form" method="post" onSubmit={onSubmit} noValidate>
      {mode === "forgot" && (
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      )}
      {mode === "reset" && (
        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
          <p className="hint">At least 10 characters.</p>
        </div>
      )}
      <p className={isError ? "form-error" : "hint"} role="alert" aria-live="polite">{message}</p>
      {!done && (
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "confirm" ? "Confirm my email" : mode === "forgot" ? "Send reset link" : "Set new password"}
        </button>
      )}
      {done && (mode === "confirm" || mode === "reset") && (
        <Link className="button" href={mode === "reset" ? "/login" : "/dashboard"}>
          {mode === "reset" ? "Go to log in" : "Open dashboard"} <span className="arrow" aria-hidden="true">→</span>
        </Link>
      )}
    </form>
  );
}
