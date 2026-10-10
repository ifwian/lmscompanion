"use client";

import Link from "next/link";

// Shown when a page crashes. The real error is logged on the server (see error_events); the visitor gets a calm message.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page">
      <p className="brand">e-GURO Companion</p>
      <h1>Something went wrong.</h1>
      <p className="lede">It is not your fault, and your data is safe. Try again, and if it keeps happening tell whoever runs this site.</p>
      <p className="hint">{error.digest ? `Reference: ${error.digest}` : ""}</p>
      <p className="action">
        <button type="button" className="button" onClick={reset}>Try again</button>
        <Link href="/dashboard" className="button button-quiet">Go to dashboard</Link>
      </p>
    </main>
  );
}
