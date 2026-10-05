import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActionButton from "@/components/ActionButton";
import ConnectionPanel from "@/components/ConnectionPanel";
import LmsConnectForm from "@/components/LmsConnectForm";
import LogoutButton from "@/components/LogoutButton";
import PasswordForm from "@/components/PasswordForm";
import PreferencesForm from "@/components/PreferencesForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · e-GURO Companion" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const db = getDb();
  const [connection, prefs] = await Promise.all([
    db.lmsConnection.findUnique({ where: { userId: user.id } }),
    db.notificationPreference.findUnique({ where: { userId: user.id } }),
  ]);
  const connected = Boolean(connection?.encryptedPassword);
  const needsAttention = connection?.status === "AUTH_ERROR" || connection?.status === "DISCONNECTED";

  return (
    <>
      <p className="eyebrow">Settings</p>
      <h1 className="page-title">Settings</h1>

      <section className="section" aria-labelledby="account-title">
        <div className="section-head"><span className="idx">01</span><h2 id="account-title" className="label">Account</h2></div>
        <dl className="meta-list">
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
        </dl>
        <p className="hint">Notifications are sent to this email address.</p>
      </section>

      <section className="section" id="lms" aria-labelledby="lms-title">
        <div className="section-head"><span className="idx">02</span><h2 id="lms-title" className="label">LMS connection</h2></div>
        <p className="hint">Connect your CCC e-GURO account to monitor new LMS activity.</p>
        <ConnectionPanel connection={connection} />
        <LmsConnectForm reconnect={Boolean(connection)} defaultUsername={connection?.lmsUsername} />
        {connected && !needsAttention && (
          <ActionButton url="/api/lms/disconnect" label="Disconnect" confirmText="Remove your stored e-GURO password and stop checking?" />
        )}
      </section>

      <section className="section" aria-labelledby="notif-title">
        <div className="section-head"><span className="idx">03</span><h2 id="notif-title" className="label">Notifications</h2></div>
        <PreferencesForm
          initial={{
            activitiesEnabled: prefs?.activitiesEnabled ?? true,
            quizzesEnabled: prefs?.quizzesEnabled ?? true,
            assignmentsEnabled: prefs?.assignmentsEnabled ?? true,
            announcementsEnabled: prefs?.announcementsEnabled ?? true,
          }}
        />
      </section>

      <section className="section" aria-labelledby="security-title">
        <div className="section-head"><span className="idx">04</span><h2 id="security-title" className="label">Security</h2></div>
        <PasswordForm />
        <p><LogoutButton /></p>
      </section>
    </>
  );
}
