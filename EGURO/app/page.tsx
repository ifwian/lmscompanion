import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = process.env.DATABASE_URL && process.env.AUTH_SECRET ? await getCurrentUser().catch(() => null) : null;
  return (
    <div className="landing">
      <header className="topbar">
        <Link href="/" className="wordmark">e-GURO<small>Companion</small></Link>
        <div className="topbar-actions">
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" className="button button-small">Dashboard</Link>
          ) : (
            <Link href="/login" className="button button-quiet button-small">Log in</Link>
          )}
        </div>
      </header>

      <main className="hero reveal">
        <div>
          <p className="eyebrow">For City College of Calamba students</p>
          <h1>Your LMS, without the <em>constant checking.</em></h1>
          <p className="lede">
            Connect your own e-GURO account. When something genuinely new shows up, you get one email.
            Never the same one twice.
          </p>
          <div className="hero-cta">
            {user ? (
              <Link href="/dashboard" className="button">Open dashboard <span className="arrow" aria-hidden="true">→</span></Link>
            ) : (
              <>
                <Link href="/register" className="button">Create account <span className="arrow" aria-hidden="true">→</span></Link>
                <Link href="/login" className="button button-quiet">Log in</Link>
              </>
            )}
          </div>
        </div>
        <ol className="steps" aria-label="How it works">
          <li><span className="num">01</span><div><strong>Connect</strong><span className="d">Link your own e-GURO account. Your password is stored encrypted.</span></div></li>
          <li><span className="num">02</span><div><strong>Detect</strong><span className="d">About every 15 minutes the app looks for items it has not seen before.</span></div></li>
          <li><span className="num">03</span><div><strong>Notify</strong><span className="d">New items appear on your dashboard and arrive by email, once.</span></div></li>
        </ol>
      </main>

      <footer className="footnote">
        <span>Unofficial student project. Not affiliated with City College of Calamba.</span>
        <Link href="/status">System status</Link>
      </footer>
    </div>
  );
}
