"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteAccountForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Delete your account and everything stored for it? This cannot be undone.")) return;
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/settings/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.get("password") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not delete the account.");
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <form className="form" method="post" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="delete-password">Your app password</label>
        <input id="delete-password" name="password" type="password" autoComplete="current-password" required />
        <p className="hint">This removes your account, your stored (encrypted) e-GURO password, your courses, activities, notes and notifications.</p>
      </div>
      <p className="form-error" role="alert" aria-live="polite">{error}</p>
      <button className="button button-quiet" type="submit" disabled={busy}>{busy ? "Deleting…" : "Delete my account"}</button>
    </form>
  );
}
