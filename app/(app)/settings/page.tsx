import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import ActionButton from "@/components/ActionButton";
import ConnectionPanel from "@/components/ConnectionPanel";
import DeleteAccountForm from "@/components/DeleteAccountForm";
import LmsConnectForm from "@/components/LmsConnectForm";
import LogoutButton from "@/components/LogoutButton";
import PasswordForm from "@/components/PasswordForm";
import PreferencesForm from "@/components/PreferencesForm";
import TelegramPanel from "@/components/TelegramPanel";
import { isEmailConfigured } from "@/services/email/transport";
import { isTelegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · e-GURO Companion" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const db = getDb();
  const [connection, prefs, telegramLink] = await Promise.all([
    db.lmsConnection.findUnique({ where: { userId: user.id } }),
    db.notificationPreference.findUnique({ where: { userId: user.id } }),
    db.telegramLink.findUnique({ where: { userId: user.id }, select: { chatUsername: true, linkedAt: true } }),
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
        <div>
          <p className="label">Email delivery</p>
          {isEmailConfigured() ? (
            <>
              <p className="hint">Email is set up on the server. Send yourself a test to make sure it arrives.</p>
              <ActionButton url="/api/settings/test-email" label="Send test email" busyLabel="Sending…" quiet={false} />
            </>
          ) : (
            <p className="hint">Email is not set up on the server yet, so no emails can be sent. Fill in SMTP_USER, SMTP_PASSWORD and MAIL_FROM in .env, restart the app, and this button will appear.</p>
          )}
        </div>
      </section>

      <section className="section" id="telegram" aria-labelledby="telegram-title">
        <div className="section-head"><span className="idx">04</span><h2 id="telegram-title" className="label">Telegram</h2></div>
        <TelegramPanel
          configured={isTelegramConfigured()}
          initial={{
            linked: Boolean(telegramLink),
            chatUsername: telegramLink?.chatUsername ?? null,
            linkedAt: telegramLink?.linkedAt.toISOString() ?? null,
            enabled: prefs?.telegramEnabled ?? false,
          }}
        />
      </section>

      <section className="section" aria-labelledby="security-title">
        <div className="section-head"><span className="idx">05</span><h2 id="security-title" className="label">Security</h2></div>
        <PasswordForm />
        <p><LogoutButton /></p>
      </section>

      <section className="section" aria-labelledby="delete-title">
        <div className="section-head"><span className="idx">06</span><h2 id="delete-title" className="label">Delete account</h2></div>
        <DeleteAccountForm />
      </section>
    </>
  );
}
