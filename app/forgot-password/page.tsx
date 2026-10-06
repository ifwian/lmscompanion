import Link from "next/link";
import TokenForm from "@/components/TokenForm";

export const metadata = { title: "Forgot password · e-GURO Companion" };

export default function ForgotPasswordPage() {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="wordmark">e-GURO<small>Companion</small></Link>
        <p className="display">It happens. <em>Let&apos;s fix it.</em></p>
        <p className="hint">This resets your e-GURO Companion password, not your e-GURO password.</p>
      </aside>
      <main className="auth-main reveal">
        <h1>Forgot your password?</h1>
        <p className="hint">Enter your email and we will send you a link to choose a new password.</p>
        <TokenForm mode="forgot" />
        <p className="hint"><Link href="/login">Back to log in</Link></p>
      </main>
    </div>
  );
}
