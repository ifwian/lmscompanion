// "Is it fast with a realistic amount of data?" Creates one test student with 300 items and 120 notes, then times
// each page 25 times against a running app. DEVELOPMENT ONLY: use a test database.
//   DATABASE_URL=... APP_URL=http://localhost:3010 INVITE_CODE=... node scripts/dev/speed-test.mjs
import pg from "pg";

const APP = process.env.APP_URL ?? "http://localhost:3010";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const email = `speed.${Date.now()}@example.com`;

const reg = await fetch(`${APP}/api/auth/register`, {
  method: "POST",
  headers: { Origin: APP, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Speed Test", email, password: "password-speed-1", inviteCode: process.env.INVITE_CODE ?? "", acceptTerms: true }),
});
if (reg.status !== 201) throw new Error(`Could not register the test student (${reg.status})`);
const cookie = reg.headers.getSetCookie().find((c) => c.startsWith("egaro_session=")).split(";")[0];
const uid = (await db.query("select id from users where email=$1", [email])).rows[0].id;

console.log("Seeding 6 courses, 300 items, 120 notes, 50 notifications…");
const courses = [];
for (let i = 0; i < 6; i++) courses.push((await db.query(`insert into courses (id,user_id,lms_course_id,course_code,course_name,updated_at) values (gen_random_uuid(),$1,$2,$3,$4,now()) returning id`, [uid, String(i), `SP ${i}`, `Speed course ${i}`])).rows[0].id);
await db.query(`insert into activities (id,user_id,course_id,fingerprint,lms_activity_id,lms_type,type,title,lms_status,is_unread,is_material,posted_at,due_date,last_seen_at)
  select gen_random_uuid(), $1, ($2::text[])[1 + (g % 6)], 'lms:LESSON:' || g, g::text, 'LESSON', 'ACTIVITY', 'Seeded item number ' || g,
         case when g <= 5 then 'ASSIGNED' end, (g between 6 and 25), (g between 6 and 25), now() - (g || ' hours')::interval, now() + (g || ' days')::interval, now()
  from generate_series(1,300) g`, [uid, courses]);
await db.query(`insert into notes (id,user_id,course_id,title,body,tags,updated_at)
  select gen_random_uuid(), $1, ($2::text[])[1 + (g % 6)], 'Seeded note ' || g, repeat('Some lecture text about databases and keys. ', 50), ARRAY['exam','week ' || (g % 10)], now() - (g || ' minutes')::interval from generate_series(1,120) g`, [uid, courses]);
await db.query(`insert into notifications (id,user_id,activity_id,notification_type,email_status)
  select gen_random_uuid(), $1, id, 'ACTIVITY', 'SENT' from activities where user_id=$1 limit 50`, [uid]);

const pages = ["/dashboard", "/activities?view=pending", "/activities?view=read", "/activities?view=all", "/notes", "/notes?q=databases", "/notifications", "/courses", "/settings"];
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
let slow = 0;
console.log("\nPage                          p50      p95      max");
for (const page of pages) {
  const times = [];
  for (let i = 0; i < 25; i++) {
    const t = performance.now();
    const res = await fetch(APP + page, { headers: { Cookie: cookie } });
    await res.text();
    if (res.status !== 200) throw new Error(`${page} answered ${res.status}`);
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const p95 = percentile(times, 95);
  if (p95 > 1500) slow++;
  console.log(`${page.padEnd(30)}${percentile(times, 50).toFixed(0).padStart(5)} ms ${p95.toFixed(0).padStart(5)} ms ${times[times.length - 1].toFixed(0).padStart(5)} ms`);
}
await db.query("delete from users where id=$1", [uid]);
await db.end();
console.log(slow ? `\n${slow} page(s) slower than 1.5 s at p95` : "\nSpeed test passed (every page under 1.5 s at p95, on this computer)");
process.exit(slow ? 1 : 0);
