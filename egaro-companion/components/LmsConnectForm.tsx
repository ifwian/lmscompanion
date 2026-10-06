"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LmsConnectForm({ reconnect, defaultUsername }: { reconnect: boolean; defaultUsername?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/lms/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not connect.");
        setBusy(false);
        return;
      }
      router.refresh();
      setBusy(false);
      (event.target as HTMLFormElement).reset();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <form className="form" method="post" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="lms-username">e-GURO username</label>
        <input id="lms-username" name="username" type="text" autoComplete="off" defaultValue={defaultUsername} required />
      </div>
      <div className="field">
        <label htmlFor="lms-password">e-GURO password</label>
        <input id="lms-password" name="password" type="password" autoComplete="off" required />
        <p className="hint">
          Used only to log in to your own e-GURO account. It is stored encrypted and is never shown again.
        </p>
      </div>
      <p className="form-error" role="alert" aria-live="polite">{error}</p>
      <button className="button" type="submit" disabled={busy}>
        {busy ? "Connecting…" : reconnect ? "Reconnect e-GURO" : "Connect e-GURO"}
      </button>
    </form>
  );
}
