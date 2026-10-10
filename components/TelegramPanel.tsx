"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State = { linked: boolean; chatUsername: string | null; linkedAt: string | null; enabled: boolean };

// Linking is deliberately two-sided: the app shows a one-time code, the student sends it to the bot
// from their own Telegram. Nothing here can be linked by someone who does not control that chat.
export default function TelegramPanel({ initial, configured }: { initial: State; configured: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createCode() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/telegram/link-code", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Could not create a code.");
      } else {
        setCode(result.code);
        setMessage(`Send this to the bot now: /start ${result.code} (it works once, and expires in ${result.expiresInMinutes} minutes).`);
      }
    } catch {
      setMessage("Could not reach the server.");
    }
    setBusy(false);
  }

  async function refresh() {
    const response = await fetch("/api/telegram");
    if (!response.ok) return;
    const result = await response.json();
    setState({ linked: result.linked, chatUsername: result.chatUsername, linkedAt: result.linkedAt, enabled: result.enabled });
  }

  async function unlink() {
    if (!window.confirm("Unlink Telegram and turn reminders off?")) return;
    setBusy(true);
    try {
      await fetch("/api/telegram", { method: "DELETE" });
      setCode(null);
      setMessage("Telegram unlinked.");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(value: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramEnabled: value }),
      });
      if (!response.ok) {
        setMessage("Could not save that switch.");
        return;
      }
      setState({ ...state, enabled: value });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div>
        <p className="hint">
          Telegram is not set up on this server. Add <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_WEBHOOK_SECRET</code> to the
          environment to turn phone reminders on.
        </p>
      </div>
    );
  }

  return (
    <div className="telegram-panel">
      {!state.linked ? (
        <>
          <p className="hint">
            1. Press the button below to get a one-time code.<br />
            2. Open your Telegram bot and send <code>/start</code> followed by that code.<br />
            3. The link is stored only after Telegram confirms the chat is yours.
          </p>
          <button type="button" className="button button-small" onClick={createCode} disabled={busy}>
            {busy ? "Working…" : "Create link code"}
          </button>
          {code && <p className="telegram-code" aria-live="polite">{code}</p>}
        </>
      ) : (
        <>
          <p className="state-line">
            <span className="dot dot-CONNECTED" aria-hidden="true" />
            Linked{state.chatUsername ? ` to @${state.chatUsername}` : ""}
          </p>
          <label className="pref-row">
            <span>Due-date reminders</span>
            <input type="checkbox" checked={state.enabled} onChange={(e) => toggleEnabled(e.target.checked)} disabled={busy} />
            <span className="pref-state">{state.enabled ? "On" : "Off"}</span>
          </label>
          <button type="button" className="button button-quiet button-small" onClick={unlink} disabled={busy}>
            {busy ? "Working…" : "Unlink Telegram"}
          </button>
        </>
      )}
      <p className="hint" role="status" aria-live="polite">{message}</p>
    </div>
  );
}