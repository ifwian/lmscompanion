import { redirect } from "next/navigation";
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
        {children}
      </main>
    </div>
  );
}
