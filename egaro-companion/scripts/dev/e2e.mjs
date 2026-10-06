// End-to-end test of the whole flow against a running app, using the MOCK e-GURO and a local SMTP sink.
// Usage: see docs/TESTING.md. It starts the mock LMS and SMTP sink itself.
import pg from "pg";
import { SMTPServer } from "smtp-server";
import { startMockLms } from "./mock-lms.mjs";

const APP = process.env.APP_URL ?? "http://localhost:3010";
const MOCK = "http://localhost:4000";
const CRON_SECRET = process.env.CRON_SECRET;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let passed = 0, failed = 0;
function check(name, condition, detail = "") {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
}

// --- SMTP sink: collects every email the app sends ---
const mails = [];
const smtp = new SMTPServer({
  authOptional: true, disabledCommands: ["STARTTLS"],
  onData(stream, _s, cb) { let raw = ""; stream.on("data", (c) => (raw += c)); stream.on("end", () => { mails.push(raw); cb(); }); },
});
await new Promise((r) => smtp.listen(2525, r));
await startMockLms(4000);
const admin = (cmd) => fetch(`${MOCK}/__admin`, { method: "POST", body: JSON.stringify(cmd) }).then((r) => r.json());

// --- tiny HTTP client with its own cookie jar per student ---
function client() {
  let cookie = "";
  return {
    async call(path, { method = "GET", body } = {}) {
      const res = await fetch(APP + path, {
        method, redirect: "manual",
        headers: { Origin: APP, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.getSetCookie().find((c) => c.startsWith("egaro_session="));
      if (set) cookie = set.split(";")[0] === "egaro_session=" ? "" : set.split(";")[0];
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch {}
      return { status: res.status, json, text, location: res.headers.get("location") };
    },
    get cookie() { return cookie; },
  };
}
const cron = (secret = CRON_SECRET) => fetch(`${APP}/api/cron/check`, { method: "POST", headers: secret ? { Authorization: `Bearer ${secret}` } : {} }).then(async (r) => ({ status: r.status, json: await r.json() }));
const makeDue = (email) => db.query(`UPDATE lms_connections SET next_check_at = now() - interval '1 minute' WHERE status IN ('CONNECTED','TEMPORARY_ERROR') AND user_id = (SELECT id FROM users WHERE email = $1)`, [email]);
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stamp = Date.now();
const emailA = `student.a.${stamp}@example.com`, emailB = `student.b.${stamp}@example.com`;
const A = client(), B = client();

console.log("\n1. Accounts and access control");
check("register A", (await A.call("/api/auth/register", { method: "POST", body: { name: "Student A", email: emailA, password: "password-aaaa-1" } })).status === 201);
check("register B", (await B.call("/api/auth/register", { method: "POST", body: { name: "Student B", email: emailB, password: "password-bbbb-1" } })).status === 201);
check("API without login -> 401", (await client().call("/api/notifications/read-all", { method: "POST" })).status === 401);
check("page without login -> redirect", (await client().call("/activities")).status === 307);
check("cron without secret -> 401", (await cron(null)).status === 401);
check("cron with wrong secret -> 401", (await cron("wrong-secret-value-123")).status === 401);
check("default prefs created (daily summary OFF)", (await one(`SELECT daily_summary_enabled d, quizzes_enabled q FROM notification_preferences WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).d === false);

console.log("\n2. Connect e-GURO (wrong password, then right)");
await admin({ addAccount: { username: "studentA", password: "lms-pass-A" } });
await admin({ addAccount: { username: "studentB", password: "lms-pass-B" } });
let r = await A.call("/api/lms/connect", { method: "POST", body: { username: "studentA", password: "WRONG" } });
check("wrong LMS password rejected (400)", r.status === 400, JSON.stringify(r.json));
check("nothing saved after wrong password", (await one(`SELECT count(*)::int c FROM lms_connections`)).c === 0);
r = await A.call("/api/lms/connect", { method: "POST", body: { username: "studentA", password: "lms-pass-A" } });
check("correct LMS password accepted", r.status === 200, JSON.stringify(r.json));
const stored = await one(`SELECT encrypted_password p, status s FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA]);
check("LMS password stored encrypted, not plaintext", stored.p.startsWith("v1:") && !stored.p.includes("lms-pass-A"));
check("status CONNECTED", stored.s === "CONNECTED");

console.log("\n3. First check = silent baseline");
await admin({ addItem: { username: "studentA", item: { lmsType: "ACTIVITY_QUIZ", id: 101, title: "Old Quiz 01", due: "2026-10-20 23:59:00" } } });
await admin({ addItem: { username: "studentA", item: { lmsType: "SUBMIT_ANSWER", id: 102, title: "Old Assignment 01", due: "" } } });
let c = await cron();
check("cron ok", c.status === 200 && c.json.summary.ok === 1, JSON.stringify(c.json));
check("2 activities saved", (await one(`SELECT count(*)::int c FROM activities WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).c === 2);
check("baseline created NO notifications", (await one(`SELECT count(*)::int c FROM notifications`)).c === 0);
check("baseline sent NO emails", mails.length === 0);

console.log("\n4. New content -> notification + email");
await admin({ addItem: { username: "studentA", item: { lmsType: "LESSON", id: 201, title: "Database Activity 04", due: "2026-10-12 17:00:00" } } });
await makeDue(emailA); c = await cron();
check("1 new item detected", (await one(`SELECT count(*)::int c FROM activities WHERE title='Database Activity 04'`)).c === 1);
check("1 notification, email SENT", (await one(`SELECT count(*)::int c FROM notifications WHERE email_status='SENT'`)).c === 1);
check("1 email delivered to A's address", mails.length === 1 && mails[0].includes(`To: ${emailA}`) && /Subject: \[ e-GURO \] New Activity: Database Activity 04/.test(mails[0]), mails[0]?.slice(0, 300));

console.log("\n5. Duplicate prevention (same content checked again)");
await makeDue(emailA); await cron(); await makeDue(emailA); await cron();
check("still exactly 1 row for that activity", (await one(`SELECT count(*)::int c FROM activities WHERE title='Database Activity 04'`)).c === 1);
check("still exactly 1 email", mails.length === 1);
check("still 1 notification", (await one(`SELECT count(*)::int c FROM notifications`)).c === 1);
check("title edited in LMS (same id) is NOT new", await (async () => {
  await admin({ addItem: { username: "studentA", item: { lmsType: "LESSON", id: 201, title: "Database Activity 04 (edited)", due: "" } } });
  await makeDue(emailA); await cron();
  return (await one(`SELECT count(*)::int c FROM activities WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).c === 3 && mails.length === 1;
})());

console.log("\n6. Preferences are respected");
check("turn quizzes OFF", (await A.call("/api/settings/preferences", { method: "POST", body: { quizzesEnabled: false } })).status === 200);
await admin({ addItem: { username: "studentA", item: { lmsType: "ACTIVITY_QUIZ", id: 301, title: "Quiz 02", due: "" } } });
await makeDue(emailA); await cron();
const quiz = await one(`SELECT n.email_status s FROM notifications n JOIN activities a ON a.id=n.activity_id WHERE a.title='Quiz 02'`);
check("quiz notification saved but email SKIPPED", quiz?.s === "SKIPPED");
check("no email sent for the quiz", mails.length === 1);
check("invalid preference value rejected", (await A.call("/api/settings/preferences", { method: "POST", body: { quizzesEnabled: "yes" } })).status === 400);

console.log("\n7. Two students never mix");
r = await B.call("/api/lms/connect", { method: "POST", body: { username: "studentB", password: "lms-pass-B" } });
check("B connects own account", r.status === 200);
await admin({ addItem: { username: "studentB", item: { lmsType: "SUBMIT_ANSWER", id: 401, title: "B-Secret-Assignment", due: "" } } });
await cron(); // baseline for B
await admin({ addItem: { username: "studentB", item: { lmsType: "LESSON", id: 402, title: "B-Only-New-Item", due: "" } } });
await makeDue(emailB); await cron();
const aPages = (await A.call("/activities")).text + (await A.call("/notifications")).text + (await A.call("/dashboard")).text + (await A.call("/settings")).text;
const bPages = (await B.call("/activities")).text + (await B.call("/notifications")).text + (await B.call("/dashboard")).text;
check("A sees A's items", aPages.includes("Database Activity 04"));
check("A never sees B's items or email", !aPages.includes("B-Only-New-Item") && !aPages.includes("B-Secret-Assignment") && !aPages.includes(emailB));
check("B sees B's new item, none of A's", bPages.includes("B-Only-New-Item") && !bPages.includes("Database Activity 04") && !bPages.includes("Old Quiz 01"));
check("B's email went only to B", mails.some((m) => m.includes(`To: ${emailB}`) && m.includes("B-Only-New-Item")) && !mails.some((m) => m.includes(`To: ${emailA}`) && m.includes("B-Only")));
const aNote = await one(`SELECT id FROM notifications WHERE user_id=(SELECT id FROM users WHERE email=$1) LIMIT 1`, [emailA]);
check("B cannot mark A's notification read (404)", (await B.call(`/api/notifications/${aNote.id}/read`, { method: "POST" })).status === 404);
check("A's notification still unread", (await one(`SELECT read_at FROM notifications WHERE id=$1`, [aNote.id])).read_at === null);

console.log("\n8. Notification center");
check("mark one as read", (await A.call(`/api/notifications/${aNote.id}/read`, { method: "POST" })).status === 200);
check("read persisted", (await one(`SELECT read_at FROM notifications WHERE id=$1`, [aNote.id])).read_at !== null);
check("mark all as read", (await A.call("/api/notifications/read-all", { method: "POST" })).status === 200);
check("no unread left for A", (await one(`SELECT count(*)::int c FROM notifications WHERE read_at IS NULL AND user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).c === 0);
check("B's notifications untouched", (await one(`SELECT count(*)::int c FROM notifications WHERE read_at IS NULL AND user_id=(SELECT id FROM users WHERE email=$1)`, [emailB])).c === 1);

console.log("\n9. Failures");
await admin({ down: true }); await makeDue(emailA); await cron(); await admin({ down: false });
let conn = await one(`SELECT status s, last_error_code e, next_check_at > now() AS later FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA]);
check("e-GURO down -> TEMPORARY_ERROR with backoff", conn.s === "TEMPORARY_ERROR" && conn.e === "TEMPORARY" && conn.later === true, JSON.stringify(conn));
c = await cron();
check("not retried before backoff ends", c.json.summary.due === 0 || c.json.summary.checked === 0);
await admin({ breakFormat: true }); await makeDue(emailA); await cron(); await admin({ breakFormat: false });
conn = await one(`SELECT status s, last_error_code e FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA]);
check("format change detected (FORMAT_CHANGED)", conn.e === "FORMAT_CHANGED" && conn.s === "TEMPORARY_ERROR", JSON.stringify(conn));
check("B unaffected by A's failures", (await one(`SELECT status s FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailB])).s === "CONNECTED");
await makeDue(emailA); await cron(); // recovers
conn = await one(`SELECT status s FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA]);
check("recovers to CONNECTED when e-GURO is back", conn.s === "CONNECTED", JSON.stringify(conn));

console.log("\n10. LMS password changed -> no hammering");
await admin({ setPassword: { username: "studentA", password: "lms-new-pass" } });
const before = (await admin({})).stats.loginAttempts.studentA;
await makeDue(emailA); await cron();
conn = await one(`SELECT status s, next_check_at n FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA]);
check("AUTH_ERROR after rejected login", conn.s === "AUTH_ERROR" && conn.n === null);
for (let i = 0; i < 3; i++) { await db.query(`UPDATE lms_connections SET next_check_at = now() - interval '1 minute'`); await cron(); }
const after = (await admin({})).stats.loginAttempts.studentA;
check("only ONE login attempt after the password changed", after === before + 1, `before=${before} after=${after}`);
check("dashboard tells the student to update", (await A.call("/dashboard")).text.includes("needs to be updated"));
const emailsBefore = mails.length;
r = await A.call("/api/lms/connect", { method: "POST", body: { username: "studentA", password: "lms-new-pass" } });
check("reconnect with new password", r.status === 200);
await makeDue(emailA); await cron();
check("reconnect did not re-announce old items", mails.length === emailsBefore && (await one(`SELECT status s FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).s === "CONNECTED");

console.log("\n11. Security details");
const other = await fetch(`${APP}/api/settings/preferences`, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json", Cookie: A.cookie }, body: "{}" });
check("cross-site request blocked (403)", other.status === 403);
check("LMS password never appears in any page", !(await A.call("/settings")).text.includes("lms-new-pass"));
const oldCookie = A.cookie;
await sleep(1100);
r = await A.call("/api/settings/password", { method: "POST", body: { currentPassword: "password-aaaa-1", newPassword: "password-aaaa-2" } });
check("change app password", r.status === 200, JSON.stringify(r.json));
const stale = await fetch(`${APP}/dashboard`, { headers: { Cookie: oldCookie }, redirect: "manual" });
check("old session rejected after password change", stale.status === 307);
check("new session still works", (await A.call("/dashboard")).status === 200);
check("logout works", (await A.call("/api/auth/logout", { method: "POST" })).status === 200);
check("after logout API is 401", (await A.call("/api/notifications/read-all", { method: "POST" })).status === 401);

console.log(`\nResult: ${passed} passed, ${failed} failed`);
await db.end(); smtp.close();
process.exit(failed ? 1 : 0);
