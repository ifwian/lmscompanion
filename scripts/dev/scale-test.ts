// "Can it handle my whole class?" Creates many pretend students (DEVELOPMENT ONLY, in a test database), points them at
// the PRETEND e-GURO, runs the real checker and reports how long it takes. Do not point this at your real database.
//   DATABASE_URL=... ENCRYPTION_KEY=... LMS_BASE_URL=http://localhost:4400 DELAY_BETWEEN_USERS_MS=0 MAX_USERS_PER_RUN=100 \
//   npx tsx scripts/dev/scale-test.ts 100
import { startMockLms } from "./mock-lms.mjs";
import { encryptSecret } from "../../lib/crypto";
import { getDb } from "../../lib/db";
import { runChecker } from "../../services/checker/run";

const N = Number(process.argv[2] ?? 100);
const MOCK = "http://localhost:4400";
const stamp = Date.now();
const admin = (cmd: object) => fetch(`${MOCK}/__admin`, { method: "POST", body: JSON.stringify(cmd) });
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} ${ok ? "" : detail}`);
  if (!ok) failed++;
}

async function main() {
  if (!process.env.LMS_BASE_URL?.startsWith("http://localhost")) throw new Error("Safety stop: LMS_BASE_URL must point at the local pretend e-GURO.");
  await startMockLms(4400);
  const db = getDb();
  console.log(`Creating ${N} pretend students…`);
  for (let i = 1; i <= N; i++) {
    await admin({ addAccount: { username: `scale${i}`, password: `pw-${i}`, courses: [{ teacher_class_id: 50000 + i, class_name: "x", subject_code: `SC ${i}`, subject_text: `Course ${i}` }] } });
    await admin({ addItems: { username: `scale${i}`, items: [1, 2, 3, 4].map((j) => ({ lmsType: "LESSON", id: i * 10 + j, title: `Item ${i}-${j}`, lists: ["ASSIGNED"] })) } });
    await db.user.create({
      data: {
        name: `Scale ${i}`, email: `scale${i}.${stamp}@example.com`, passwordHash: "not-a-real-hash", emailVerifiedAt: new Date(),
        notificationPreferences: { create: {} },
        lmsConnection: { create: { lmsUsername: `scale${i}`, encryptedPassword: encryptSecret(`pw-${i}`), status: "CONNECTED", baselineDone: false } },
      },
    });
  }
  const mine = { user: { email: { startsWith: "scale", endsWith: `${stamp}@example.com` } } };

  console.log("\nPhase 1: first check of everyone (silent baseline)");
  const started = Date.now();
  let runs = 0;
  while (runs < 10) {
    const t = Date.now();
    const s = await runChecker();
    runs++;
    console.log(`  run ${runs}: due ${s.due}, ok ${s.ok}, failed ${s.failed}, ${((Date.now() - t) / 1000).toFixed(1)} s`);
    // ownership: ok - development test across the pretend students it just created
    if ((await db.lmsConnection.count({ where: { ...mine, baselineDone: false } })) === 0) break;
  }
  const seconds = (Date.now() - started) / 1000;
  // ownership: ok - development test across the pretend students it just created
  const activities = await db.activity.count({ where: mine });
  // ownership: ok - development test across the pretend students it just created
  const failedStudents = await db.lmsConnection.count({ where: { ...mine, status: { not: "CONNECTED" } } });
  check(`all ${N} students checked in ${seconds.toFixed(0)} s (${((N / seconds) * 60).toFixed(0)} students per minute)`, failedStudents === 0, `${failedStudents} not CONNECTED`);
  check(`every item saved exactly once (${N * 4} expected)`, activities === N * 4, `got ${activities}`);
  // ownership: ok - development test across the pretend students it just created
  check("the first check created no notifications", (await db.notification.count({ where: mine })) === 0);

  console.log("\nPhase 2: 10 students get a new item");
  for (let i = 1; i <= 10; i++) await admin({ addItem: { username: `scale${i}`, item: { lmsType: "LESSON", id: i * 10 + 9, title: `New ${i}`, lists: ["ASSIGNED"] } } });
  // ownership: ok - development test across the pretend students it just created
  await db.lmsConnection.updateMany({ where: mine, data: { nextCheckAt: new Date(Date.now() - 60_000) } });
  const t2 = Date.now();
  await runChecker();
  // ownership: ok - development test across the pretend students it just created
  const notes = await db.notification.count({ where: mine });
  check(`exactly 10 notifications (one per new item), found ${notes}`, notes === 10);
  console.log(`  second pass took ${((Date.now() - t2) / 1000).toFixed(1)} s`);

  // ownership: ok - development cleanup of the pretend students it created
  await db.user.deleteMany({ where: { email: { startsWith: "scale", endsWith: `${stamp}@example.com` } } });
  console.log(failed ? `\n${failed} FAILED` : "\nScale test passed");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
