import { redirect } from "next/navigation";
import ActionButton from "@/components/ActionButton";
import AppNav from "@/components/AppNav";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Shared frame for every signed-in page. The server-side login check lives here AND in the API routes.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="shell">
      <AppNav name={user.name} />
      <main className="content reveal" id="main">
        {!user.emailVerifiedAt && (
          <div className="banner" role="status">
            <p>Confirm your email address ({user.email}) to receive notifications. We sent you a link when you signed up.</p>
            <ActionButton url="/api/auth/resend-verification" label="Send the link again" busyLabel="Sending…" />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
