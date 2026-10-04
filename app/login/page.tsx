import { redirect } from "next/navigation";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · e-GURO Companion" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="wordmark">e-GURO<small>Companion</small></Link>
        <p className="display">Welcome <em>back.</em></p>
        <p className="hint">Unofficial student project. Not affiliated with City College of Calamba.</p>
      </aside>
      <main className="auth-main reveal">
        <h1>Log in</h1>
        <AuthForm mode="login" />
      </main>
    </div>
  );
}
