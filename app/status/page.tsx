import Link from "next/link";
import { getHealthReport } from "@/lib/health";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status · e-GURO Companion" };

export default async function StatusPage() {
  const report = await getHealthReport();

  return (
    <main className="page">
      <p className="brand">e-GURO Companion</p>
      <h1>System status</h1>
      <p className="lede">Shows whether the app can reach its database. No secret values are displayed.</p>

      <ul className="rows" aria-label="System checks">
        <li className="row">
          <span className="label">App</span>
          <span className="state">OK</span>
        </li>
        <li className="row">
          <span className="label">Database</span>
          <span className="state">
            {report.database.state.toUpperCase()}: {report.database.message}
          </span>
        </li>
        <li className="row">
          <span className="label">Database updates</span>
          <span className="state">
            {report.updates.state.toUpperCase()}: {report.updates.message}
          </span>
        </li>
        {report.env.map((item) => (
          <li className="row" key={item.name}>
            <span className="label">{item.name}</span>
            <span className="state">{item.set ? "SET" : "NOT SET"}</span>
          </li>
        ))}
      </ul>

      <p className="meta" style={{ marginTop: "1.5rem" }}>Checked {report.checkedAt}</p>
      <p className="link-row">
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
