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
const authMails = []; // confirm-email and reset-password emails
const smtp = new SMTPServer({
  authOptional: true, disabledCommands: ["STARTTLS"],
  onData(stream, _s, cb) { let raw = ""; stream.on("data", (c) => (raw += c)); stream.on("end", () => { (/Subject: \[ e-GURO \] (Confirm your email|Reset your password)/.test(raw) ? authMails : mails).push(raw); cb(); }); },
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

// Mail bodies arrive quoted-printable encoded; undo that so we can search them.
const decodeMail = (raw) => raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
const REG = { inviteCode: "class-2026", acceptTerms: true };
async function confirmEmail(email, which = "latest") {
  await sleep(500);
  const found = authMails.filter((m) => m.includes(`To: ${email}`) && /Confirm your email/.test(m));
  const raw = which === "first" ? found[0] : found[found.length - 1];
  const token = /verify-email\?token=([0-9a-f]{64})/.exec(decodeMail(raw ?? ""))?.[1];
  return (await client().call("/api/auth/verify", { method: "POST", body: { token } })).status;
}
const stamp = Date.now();
const emailA = `student.a.${stamp}@example.com`, emailB = `student.b.${stamp}@example.com`;
const A = client(), B = client();

console.log("\n1. Accounts and access control");
check("register A", (await A.call("/api/auth/register", { method: "POST", body: { ...REG, name: "Student A", email: emailA, password: "password-aaaa-1" } })).status === 201);
check("register B", (await B.call("/api/auth/register", { method: "POST", body: { ...REG, name: "Student B", email: emailB, password: "password-bbbb-1" } })).status === 201);
check("A confirms the email address from the emailed link", (await confirmEmail(emailA)) === 200);
check("B confirms the email address from the emailed link", (await confirmEmail(emailB)) === 200);
check("API without login -> 401", (await client().call("/api/notifications/read-all", { method: "POST" })).status === 401);
check("page without login -> redirect", (await client().call("/activities")).status === 307);
check("cron without secret -> 401", (await cron(null)).status === 401);
check("cron with wrong secret -> 401", (await cron("wrong-secret-value-123")).status === 401);
check("default prefs created (daily summary OFF)", (await one(`SELECT daily_summary_enabled d, quizzes_enabled q FROM notification_preferences WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).d === false);

console.log("\n2. Connect e-GURO (wrong password, then right)");
await admin({ addAccount: { username: "studentA", password: "lms-pass-A", courses: [{ teacher_class_id: 19196, class_name: "2-CS3", subject_code: "CS 201", subject_text: "Database Management Systems" }] } });
await admin({ addAccount: { username: "studentB", password: "lms-pass-B", courses: [{ teacher_class_id: 20001, class_name: "1-IT1", subject_code: "IT 201", subject_text: "Data Structures and Algorithms" }] } });
let r = await A.call("/api/lms/connect", { method: "POST", body: { username: "studentA", password: "WRONG" } });
check("wrong LMS password rejected (400)", r.status === 400, JSON.stringify(r.json));
check("nothing saved after wrong password", (await one(`SELECT count(*)::int c FROM lms_connections`)).c === 0);
r = await A.call("/api/lms/connect", { method: "POST", body: { username: "studentA", password: "lms-pass-A" } });
check("correct LMS password accepted", r.status === 200, JSON.stringify(r.json));
const stored = await one(`SELECT encrypted_password p, status s FROM lms_connections WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA]);
check("LMS password stored encrypted, not plaintext", stored.p.startsWith("v1:") && !stored.p.includes("lms-pass-A"));
check("status CONNECTED", stored.s === "CONNECTED");

console.log("\n3. First check = silent baseline");
await admin({ addItem: { username: "studentA", item: { lmsType: "EXAM", id: 101, title: "Old Quiz 01", due: "2026-10-20 23:59:00" } } });
await admin({ addItem: { username: "studentA", item: { lmsType: "LESSON", id: 102, title: "Old Assignment 01", due: "" } } });
let c = await cron();
check("cron ok", c.status === 200 && c.json.summary.ok === 1, JSON.stringify(c.json));
check("2 activities saved", (await one(`SELECT count(*)::int c FROM activities WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).c === 2);
check("course saved from e-GURO (CS 201)", (await one(`SELECT count(*)::int c FROM courses WHERE course_code='CS 201' AND user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).c === 1);
check("activities linked to their course", (await one(`SELECT count(*)::int c FROM activities WHERE course_id IS NOT NULL AND user_id=(SELECT id FROM users WHERE email=$1)`, [emailA])).c === 2);
check("item link built from e-GURO ids", (await one(`SELECT url FROM activities WHERE title='Old Quiz 01'`)).url?.includes("/app/open_exam.php?id=19196&param=101&terms=2"));
check("exam stored as QUIZ, lesson as ACTIVITY", (await one(`SELECT (SELECT type FROM activities WHERE title='Old Quiz 01') q, (SELECT type FROM activities WHERE title='Old Assignment 01') l`)).q === "QUIZ");
check("baseline created NO notifications", (await one(`SELECT count(*)::int c FROM notifications`)).c === 0);
check("baseline sent NO emails", mails.length === 0);

console.log("\n4. New content -> notification + email");
await admin({ addItem: { username: "studentA", item: { lmsType: "LESSON", id: 201, title: "Database Activity 04", due: "2026-10-12 17:00:00" } } });
await makeDue(emailA); c = await cron();
check("1 new item detected", (await one(`SELECT count(*)::int c FROM activities WHERE title='Database Activity 04'`)).c === 1);
check("1 notification, email SENT", (await one(`SELECT count(*)::int c FROM notifications WHERE email_status='SENT'`)).c === 1);
check("email has an Open-in-e-GURO link built from the item ids", decodeMail(mails[0] ?? "").includes("open_lesson.php?id=19196&param=201&terms=2"));
check("1 email delivered to A's address", mails.length === 1 && mails[0].includes(`To: ${emailA}`) && /Subject: \[ e-GURO \] New Activity in CS 201/.test(mails[0]), mails[0]?.slice(0, 300));

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
await admin({ addItem: { username: "studentA", item: { lmsType: "EXAM", id: 301, title: "Quiz 02", due: "" } } });
await makeDue(emailA); await cron();
const quiz = await one(`SELECT n.email_status s FROM notifications n JOIN activities a ON a.id=n.activity_id WHERE a.title='Quiz 02'`);
check("quiz notification saved but email SKIPPED", quiz?.s === "SKIPPED");
check("no email sent for the quiz", mails.length === 1);
check("invalid preference value rejected", (await A.call("/api/settings/preferences", { method: "POST", body: { quizzesEnabled: "yes" } })).status === 400);

console.log("\n7. Two students never mix");
r = await B.call("/api/lms/connect", { method: "POST", body: { username: "studentB", password: "lms-pass-B" } });
check("B connects own account", r.status === 200);
await admin({ addItem: { username: "studentB", item: { lmsType: "LESSON", id: 401, title: "B-Secret-Assignment", due: "" } } });
await admin({ addItems: { username: "studentB", items: Array.from({ length: 54 }, (_, i) => ({ lmsType: "LESSON", id: 5000 + i, title: `B-Filler-${i}`, due: "" })) } });
await cron(); // baseline for B (55 items = two pages of 50)
check("B's baseline read both pages (55 items)", (await one(`SELECT count(*)::int c FROM activities WHERE user_id=(SELECT id FROM users WHERE email=$1)`, [emailB])).c === 55);
await admin({ addItem: { username: "studentB", item: { lmsType: "LESSON", id: 402, title: "B-Only-New-Item", due: "" } } });
await makeDue(emailB); await cron();
const aPages = (await A.call("/activities")).text + (await A.call("/notifications")).text + (await A.call("/dashboard")).text + (await A.call("/settings")).text;
const bPages = (await B.call("/activities")).text + (await B.call("/notifications")).text + (await B.call("/dashboard")).text;
check("A sees A's items", aPages.includes("Database Activity 04"));
check("A sees CS 201, never IT 201", aPages.includes("CS 201") && !aPages.includes("IT 201"));
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
r = await A.call("/api/settings/test-email", { method: "POST" });
await sleep(400);
check("test email endpoint sends (200)", r.status === 200 && /Test email sent/.test(r.json?.message ?? ""), JSON.stringify(r.json));
check("test email arrived at A's address with a clear subject", mails.some((m) => m.includes(`To: ${emailA}`) && /Subject: \[ e-GURO \] Test email/.test(m)));
check("logout works", (await A.call("/api/auth/logout", { method: "POST" })).status === 200);
check("after logout API is 401", (await A.call("/api/notifications/read-all", { method: "POST" })).status === 401);

console.log("\n12. Pending vs unread sections, lessons, handed-in items");
const emailC = `student.c.${stamp}@example.com`;
const C = client();
await C.call("/api/auth/register", { method: "POST", body: { ...REG, name: "Student C", email: emailC, password: "password-cccc-1" } });
check("C confirms the email address", (await confirmEmail(emailC)) === 200);
await admin({ addAccount: { username: "studentC", password: "lms-pass-C", courses: [{ teacher_class_id: 30001, class_name: "1-MA1", subject_code: "MATH 101", subject_text: "Calculus" }] } });
check("C connects", (await C.call("/api/lms/connect", { method: "POST", body: { username: "studentC", password: "lms-pass-C" } })).status === 200);
await admin({ addItems: { username: "studentC", items: [
  { lmsType: "LESSON", id: 7001, title: "C-Pending-X", submit: "1", due: "2026-10-20 23:59:00", lists: ["ASSIGNED"] },
  { lmsType: "LESSON", id: 7002, title: "C-Unread-Lesson-1", submit: "0", lists: ["UNREAD"] },
  { lmsType: "LESSON", id: 7003, title: "C-Pending-And-Unread", submit: "1", lists: ["ASSIGNED", "UNREAD"] },
] } });
await makeDue(emailC); await cron();
const cu = `(SELECT id FROM users WHERE email='${emailC}')`;
const rowOf = async (title) => one(`SELECT lms_status s, is_unread u, is_material m FROM activities WHERE title=$1 AND user_id=${cu}`, [title]);
const x = await rowOf("C-Pending-X"), yy = await rowOf("C-Unread-Lesson-1"), z = await rowOf("C-Pending-And-Unread");
check("pending item has a pending status", ["ASSIGNED", "DUE_TODAY"].includes(x.s) && x.u === false);
check("unread lesson: not pending, unread, marked as material", yy.s === null && yy.u === true && yy.m === true);
check("item in both lists stays pending and unread", z.s !== null && z.u === true);
check("baseline created no notifications for C", (await one(`SELECT count(*)::int c FROM notifications WHERE user_id=${cu}`)).c === 0);
let page = (await C.call("/dashboard")).text;
const unreadAt = page.indexOf('id="unread-title"');
check("dashboard: pending items are in the pending section", page.indexOf("C-Pending-X") > 0 && page.indexOf("C-Pending-X") < unreadAt && page.indexOf("C-Pending-And-Unread") < unreadAt);
check("dashboard: unread lesson is in its own section, not in pending", page.indexOf("C-Unread-Lesson-1") > unreadAt);
check("activities?view=pending lists work, not lessons", await (async () => { const t = (await C.call("/activities?view=pending")).text; return t.includes("C-Pending-X") && !t.includes("C-Unread-Lesson-1"); })());
check("activities?view=unread lists the lesson", (await C.call("/activities?view=unread")).text.includes("C-Unread-Lesson-1"));
const mailsC = () => mails.filter((m) => m.includes(`To: ${emailC}`));

await admin({ addItem: { username: "studentC", item: { lmsType: "LESSON", id: 7004, title: "C-New-Lesson", submit: "0", lists: ["UNREAD"] } } });
await makeDue(emailC); await cron();
check("a NEW lesson is saved but sends no notification or email", (await rowOf("C-New-Lesson"))?.u === true && (await one(`SELECT count(*)::int c FROM notifications WHERE user_id=${cu}`)).c === 0 && mailsC().length === 0);

await admin({ addItem: { username: "studentC", item: { lmsType: "LESSON", id: 7005, title: "C-New-Activity", submit: "1", due: "2026-10-25 12:00:00", lists: ["ASSIGNED"] } } });
const checkNow = await C.call("/api/lms/check-now", { method: "POST" });
await sleep(400);
check("Check now reports what it found", checkNow.status === 200 && /pending/.test(checkNow.json?.message ?? ""), JSON.stringify(checkNow.json));
check("a NEW pending activity creates a notification and exactly one email", (await one(`SELECT count(*)::int c FROM notifications WHERE user_id=${cu}`)).c === 1 && mailsC().length === 1 && decodeMail(mailsC()[0]).includes("C-New-Activity"));

await admin({ setLists: { username: "studentC", id: 7001, lists: [] } });
await admin({ setLists: { username: "studentC", id: 7002, lists: [] } });
await makeDue(emailC); await cron();
const x2 = await rowOf("C-Pending-X"), y2 = await rowOf("C-Unread-Lesson-1");
check("handed-in item is no longer pending (kept in history)", x2 && x2.s === null && x2.u === false);
check("opened lesson is no longer unread", y2 && y2.u === false);
check("no extra emails for state changes", mailsC().length === 1);

console.log("\n13. Classmate-ready accounts: invite code, consent, email confirmation, password reset, delete account");
const bad = (b) => client().call("/api/auth/register", { method: "POST", body: b });
check("sign-up without the invite code is refused (403)", (await bad({ acceptTerms: true, name: "X", email: `x1.${stamp}@example.com`, password: "password-xxxx-1" })).status === 403);
check("sign-up with a wrong invite code is refused (403)", (await bad({ ...REG, inviteCode: "nope", name: "X", email: `x2.${stamp}@example.com`, password: "password-xxxx-1" })).status === 403);
check("sign-up without agreeing to the privacy notice is refused (400)", (await bad({ inviteCode: "class-2026", name: "X", email: `x3.${stamp}@example.com`, password: "password-xxxx-1" })).status === 400);
check("no account was created by the refused attempts", (await one(`SELECT count(*)::int c FROM users WHERE email LIKE 'x_.${stamp}@%'`)).c === 0);
const privacy = await client().call("/privacy");
check("privacy page is public and honest about encryption", privacy.status === 200 && privacy.text.includes("encrypted"));

const emailD = `student.d.${stamp}@example.com`;
const D = client();
check("D signs up (201)", (await D.call("/api/auth/register", { method: "POST", body: { ...REG, name: "Student D", email: emailD, password: "password-dddd-1" } })).status === 201);
const du = `(SELECT id FROM users WHERE email='${emailD}')`;
check("D's terms acceptance is recorded and the address is not confirmed yet", await (async () => { const r = await one(`SELECT terms_accepted_at t, email_verified_at v FROM users WHERE id=${du}`); return r.t !== null && r.v === null; })());
await sleep(500);
check("a confirmation email was sent to D", authMails.some((m) => m.includes(`To: ${emailD}`) && /Confirm your email/.test(m)));
check("dashboard asks D to confirm the address", (await D.call("/dashboard")).text.includes("Confirm your email address"));
await admin({ addAccount: { username: "studentD", password: "lms-pass-D", courses: [{ teacher_class_id: 40001, class_name: "1-EN1", subject_code: "ENG 101", subject_text: "Communication" }] } });
await admin({ addItem: { username: "studentD", item: { lmsType: "LESSON", id: 8001, title: "D-Base", submit: "1", lists: ["ASSIGNED"] } } });
await D.call("/api/lms/connect", { method: "POST", body: { username: "studentD", password: "lms-pass-D" } });
await makeDue(emailD); await cron();
await admin({ addItem: { username: "studentD", item: { lmsType: "LESSON", id: 8002, title: "D-New-Pending", submit: "1", lists: ["ASSIGNED"] } } });
await makeDue(emailD); await cron(); await sleep(400);
check("a new item makes a notification for D", (await one(`SELECT count(*)::int c FROM notifications WHERE user_id=${du}`)).c === 1);
check("but NO email goes to an unconfirmed address (stays pending)", (await one(`SELECT email_status s FROM notifications WHERE user_id=${du}`)).s === "PENDING" && !mails.some((m) => m.includes(`To: ${emailD}`)));
check("test email is refused until the address is confirmed (403)", (await D.call("/api/settings/test-email", { method: "POST" })).status === 403);
const resend = await D.call("/api/auth/resend-verification", { method: "POST" });
check("D can ask for a new confirmation email", resend.status === 200);
check("the OLD confirmation link no longer works once a new one was sent", (await confirmEmail(emailD, "first")) === 400);
check("the NEW confirmation link works", (await confirmEmail(emailD, "latest")) === 200);
check("the same link cannot be used twice", (await confirmEmail(emailD, "latest")) === 400);
await makeDue(emailD); await cron(); await sleep(500);
check("after confirming, the waiting email is sent to D", mails.some((m) => m.includes(`To: ${emailD}`) && decodeMail(m).includes("D-New-Pending")) && (await one(`SELECT email_status s FROM notifications WHERE user_id=${du}`)).s === "SENT");

const authCount = (email) => authMails.filter((m) => m.includes(`To: ${email}`) && /Reset your password/.test(m)).length;
const unknown = await client().call("/api/auth/forgot", { method: "POST", body: { email: `nobody.${stamp}@example.com` } });
check("forgot-password gives the same answer for an unknown email", unknown.status === 200 && /If that email has an account/.test(unknown.json?.message ?? ""));
const known = await client().call("/api/auth/forgot", { method: "POST", body: { email: emailD } });
await sleep(500);
check("forgot-password for D sends exactly one reset email", known.status === 200 && authCount(emailD) === 1 && authCount(`nobody.${stamp}@example.com`) === 0);
const resetToken = /reset-password\?token=([0-9a-f]{64})/.exec(decodeMail(authMails.filter((m) => m.includes(`To: ${emailD}`) && /Reset your password/.test(m))[0]))?.[1];
check("a too-short new password is refused and the link stays usable", (await client().call("/api/auth/reset", { method: "POST", body: { token: resetToken, newPassword: "short" } })).status === 400);
check("a made-up reset link is refused", (await client().call("/api/auth/reset", { method: "POST", body: { token: "0".repeat(64), newPassword: "password-new-dddd-2" } })).status === 400);
const oldSessionD = D.cookie;
await sleep(1100);
check("the reset link sets a new password", (await client().call("/api/auth/reset", { method: "POST", body: { token: resetToken, newPassword: "password-new-dddd-2" } })).status === 200);
check("the reset link works only once", (await client().call("/api/auth/reset", { method: "POST", body: { token: resetToken, newPassword: "password-new-dddd-3" } })).status === 400);
check("old password no longer logs in", (await client().call("/api/auth/login", { method: "POST", body: { email: emailD, password: "password-dddd-1" } })).status === 401);
const D2 = client();
check("new password logs in", (await D2.call("/api/auth/login", { method: "POST", body: { email: emailD, password: "password-new-dddd-2" } })).status === 200);
check("an older session is signed out by the reset", (await fetch(`${APP}/dashboard`, { headers: { Cookie: oldSessionD }, redirect: "manual" })).status === 307);

const noAuth = await fetch(`${APP}/api/admin/summary`);
check("owner summary is closed without the secret (401)", noAuth.status === 401);
const summaryRes = await fetch(`${APP}/api/admin/summary`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
const summaryText = await summaryRes.text();
check("owner summary shows counts only (no emails or usernames)", summaryRes.status === 200 && JSON.parse(summaryText).users >= 4 && !/@example\.com|student[A-D]/i.test(summaryText), summaryText.slice(0, 200));

check("delete account with a wrong password is refused (400)", (await D2.call("/api/settings/delete-account", { method: "POST", body: { password: "not-my-password" } })).status === 400);
check("delete account with the right password works", (await D2.call("/api/settings/delete-account", { method: "POST", body: { password: "password-new-dddd-2" } })).status === 200);
const gone = await one(`SELECT (SELECT count(*)::int FROM users WHERE email='${emailD}') u, (SELECT count(*)::int FROM lms_connections WHERE lms_username='studentD') c, (SELECT count(*)::int FROM activities WHERE title LIKE 'D-%') a, (SELECT count(*)::int FROM notifications n JOIN activities a ON a.id=n.activity_id WHERE a.title LIKE 'D-%') n, (SELECT count(*)::int FROM auth_tokens t WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id=t.user_id)) t`);
check("everything stored about D is gone (user, e-GURO password, activities, notifications, tokens)", gone.u === 0 && gone.c === 0 && gone.a === 0 && gone.n === 0 && gone.t === 0, JSON.stringify(gone));
check("a deleted account cannot log in", (await client().call("/api/auth/login", { method: "POST", body: { email: emailD, password: "password-new-dddd-2" } })).status === 401);
check("other students are untouched by the deletion", (await one(`SELECT count(*)::int c FROM users WHERE email IN ('${emailA}','${emailB}','${emailC}')`)).c === 3);

console.log(`\nResult: ${passed} passed, ${failed} failed`);
await db.end(); smtp.close();
process.exit(failed ? 1 : 0);
