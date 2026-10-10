"use client";

// Last-resort error page (used if even the main layout fails). Plain on purpose: it cannot rely on anything else loading.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1>Something went wrong.</h1>
        <p>Your data is safe. Please try again in a moment.</p>
        <button onClick={reset} style={{ padding: "0.75rem 1.25rem", cursor: "pointer" }}>Try again</button>
      </body>
    </html>
  );
}
