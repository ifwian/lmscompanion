"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

// One form component for both pages. It posts JSON to /api/auth/<mode>.
export default function AuthForm({ mode, inviteRequired = false }: { mode: Mode; inviteRequired?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      password: data.get("password"),
      inviteCode: data.get("inviteCode"),
      acceptTerms: data.get("acceptTerms") === "on",
    };
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form className="form" method="post" onSubmit={handleSubmit} noValidate>
      {isRegister && inviteRequired && (
        <div className="field">
          <label htmlFor="inviteCode">Invite code</label>
          <input id="inviteCode" name="inviteCode" type="text" autoComplete="off" required />
          <p className="hint">Ask the classmate who shared this site with you.</p>
        </div>
      )}
      {isRegister && (
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" autoComplete="name" required maxLength={80} />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        {isRegister && <p className="hint">Notifications will be sent to this address.</p>}
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 10 : undefined}
        />
        {isRegister && <p className="hint">At least 10 characters.</p>}
      </div>

      {isRegister && (
        <label className="check-row" htmlFor="acceptTerms">
          <input id="acceptTerms" name="acceptTerms" type="checkbox" required />
          <span>
            I have read the <Link href="/privacy" target="_blank">privacy notice</Link> and agree that this app stores my e-GURO password (encrypted) to check my account.
          </span>
        </label>
      )}

      <p className="form-error" role="alert" aria-live="polite">{error}</p>

      <button className="button" type="submit" disabled={busy}>
        {busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}
      </button>

      <p className="hint">
        {isRegister ? (
          <>Already have an account? <Link href="/login">Log in</Link></>
        ) : (
          <>New here? <Link href="/register">Create an account</Link> · <Link href="/forgot-password">Forgot password?</Link></>
        )}
      </p>
    </form>
  );
}
