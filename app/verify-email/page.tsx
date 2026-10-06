import Link from "next/link";
import TokenForm from "@/components/TokenForm";

export const metadata = { title: "Confirm email · e-GURO Companion" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="wordmark">e-GURO<small>Companion</small></Link>
        <p className="display">One <em>last step.</em></p>
        <p className="hint">Confirming your address means notifications only ever go to you.</p>
      </aside>
      <main className="auth-main reveal">
        <h1>Confirm your email</h1>
        {token ? <TokenForm mode="confirm" token={token} /> : <p className="hint">This link is incomplete. Open the link from the email again.</p>}
      </main>
    </div>
  );
}
