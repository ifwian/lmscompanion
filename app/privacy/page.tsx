import Link from "next/link";
import { config } from "@/lib/config";

export const metadata = { title: "Privacy · e-GURO Companion" };

// Plain-language notice. Keep it true: if the app changes, change this page.
export default function PrivacyPage() {
  return (
    <main className="page">
      <p className="brand"><Link href="/">e-GURO Companion</Link></p>
      <h1>Privacy notice</h1>
      <p className="lede">e-GURO Companion is an unofficial student project. It is not made, run or approved by City College of Calamba.</p>

      <div className="prose">
        <h2>What it does</h2>
        <p>It logs in to <em>your own</em> e-GURO account on your behalf, about every 15 minutes, reads the lists your e-GURO dashboard already shows you (pending items, unread lessons, your classes), and emails you when something new appears.</p>

        <h2>What is stored</h2>
        <ul>
          <li>Your name, email address and a scrambled (hashed) app password. We cannot read your app password.</li>
          <li>Your e-GURO username, and your e-GURO password <strong>encrypted</strong> with a key kept on the server. It is needed so the app can log in for you while you are offline. It is never shown again, never put in logs, and never emailed.</li>
          <li>The titles, types, dates and course names of the items found in your e-GURO lists, and the notifications we sent you.</li>
          <li>The notes you write in the Notes section. They are private to your account, but they are <strong>not</strong> encrypted: the person who runs this site can read them in the database. Do not put passwords or anything secret in a note.</li>
        </ul>
        <p>Nothing else is collected. No tracking, no advertising, nothing is sold or shared.</p>

        <h2>What it never does</h2>
        <ul>
          <li>It never looks at anyone else&apos;s account, grades or files, and never submits, changes or deletes anything in e-GURO. It only reads.</li>
          <li>It never uses your password for anything except logging in to e-GURO for you.</li>
        </ul>

        <h2>Who can see it</h2>
        <p>The person who runs this site has access to the database. They can see your name, email and the items we saved. They cannot read your e-GURO password without the server&apos;s encryption key, which they hold, so you are trusting them. If you are not comfortable with that, do not use the app.</p>

        <h2>Your choices</h2>
        <ul>
          <li><strong>Disconnect</strong> (Settings) removes your stored e-GURO password and stops all checking.</li>
          <li><strong>Delete my account</strong> (Settings) removes everything stored about you.</li>
          <li>If you change your e-GURO password, the app stops after one failed login and asks you to reconnect.</li>
        </ul>

        <h2>Risks</h2>
        <p>Storing a password is a real risk: if the server or its key were stolen, the encrypted passwords could be exposed. e-GURO may also have its own rules about automated access. Use this at your own discretion.</p>

        <h2>Contact</h2>
        <p>Ask the classmate who shared this site with you.{config.appUrl() ? "" : ""}</p>
      </div>
      <p className="link-row"><Link href="/register">Back to sign up</Link></p>
    </main>
  );
}
