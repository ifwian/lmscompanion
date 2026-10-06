import { redirect } from "next/navigation";
import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth/session";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account · e-GURO Companion" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="wordmark">e-GURO<small>Companion</small></Link>
        <p className="display">Stop refreshing. <em>Start knowing.</em></p>
        <p className="hint">Unofficial student project. Not affiliated with City College of Calamba.</p>
      </aside>
      <main className="auth-main reveal">
        <h1>Create your account</h1>
        <AuthForm mode="register" inviteRequired={Boolean(config.inviteCode())} />
      </main>
    </div>
  );
}
