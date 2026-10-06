import Link from "next/link";
import TokenForm from "@/components/TokenForm";

export const metadata = { title: "Reset password · e-GURO Companion" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="wordmark">e-GURO<small>Companion</small></Link>
        <p className="display">A fresh <em>start.</em></p>
        <p className="hint">Setting a new password signs you out on every other device.</p>
      </aside>
      <main className="auth-main reveal">
        <h1>Choose a new password</h1>
        {token ? <TokenForm mode="reset" token={token} /> : <p className="hint">This link is incomplete. Open the link from the email again, or <Link href="/forgot-password">ask for a new one</Link>.</p>}
      </main>
    </div>
  );
}
