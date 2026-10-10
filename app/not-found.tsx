import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <p className="brand">e-GURO Companion</p>
      <h1>Not found.</h1>
      <p className="lede">That page does not exist, or it belongs to someone else.</p>
      <p className="link-row"><Link href="/">Back to home</Link></p>
    </main>
  );
}
