// One-time setup for the person who runs the site (NOT for students).
//   npm run setup
// It creates your .env file for you: it makes the secret keys, asks only for what it cannot guess
// (database address, Gmail), creates the database tables, and can send a test email.
// Existing values in .env are kept. Passwords you type are hidden and are only written to .env.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const skipMigrate = process.argv.includes("--skip-migrate");
const skipEmailTest = process.argv.includes("--skip-email-test");
const secret = () => randomBytes(32).toString("hex");

// ---- read the template and any existing .env ----
const template = readFileSync(".env.example", "utf8").split(/\r?\n/);
const existing = new Map<string, string>();
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) existing.set(m[1], m[2].trim());
  }
}
const values = new Map(existing);

// ---- questions (answers come from the keyboard, also works when piped) ----
const rl = createInterface({ input: process.stdin, terminal: false });
const queue: string[] = [];
let waiting: ((line: string) => void) | null = null;
rl.on("line", (line) => (waiting ? ((w) => { waiting = null; w(line); })(waiting) : queue.push(line)));
function ask(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve) => (queue.length ? resolve(queue.shift()!) : (waiting = resolve)));
}

async function need(key: string, question: string, options: { hidden?: boolean; fallback?: string } = {}) {
  if (values.get(key)) return;
  const answer = (await ask(question + (options.hidden ? " (typing is not hidden in this window, do not share your screen)" : "") + "\n> ")).trim();
  values.set(key, answer || options.fallback || "");
}

async function main() {
  console.log("\ne-GURO Companion setup\n----------------------\n");

  // 1. secrets: made for you
  for (const key of ["AUTH_SECRET", "ENCRYPTION_KEY", "CRON_SECRET"]) {
    if (!values.get(key)) {
      values.set(key, secret());
      console.log(`Created ${key} automatically.`);
    }
  }
  if (!values.get("LMS_BASE_URL")) values.set("LMS_BASE_URL", "https://lms.ccc.edu.ph");

  // 2. things only you know
  await need("DATABASE_URL", "Paste your database address (Neon: Dashboard > Connect > copy the connection string that starts with postgresql://).");
  await need("SMTP_USER", "Gmail address that will SEND the emails (a new Gmail made just for this app is best). Leave empty to skip email for now.");
  if (values.get("SMTP_USER")) {
    await need("SMTP_PASSWORD", "The Gmail app password for it (16 letters; myaccount.google.com/apppasswords; spaces are fine).", { hidden: true });
    if (!values.get("MAIL_FROM")) values.set("MAIL_FROM", `e-GURO Companion <${values.get("SMTP_USER")}>`);
    if (!values.get("SMTP_HOST")) values.set("SMTP_HOST", "smtp.gmail.com");
    if (!values.get("SMTP_PORT")) values.set("SMTP_PORT", "465");
  }
  if (!existing.has("INVITE_CODE")) {
    const suggestion = randomBytes(4).toString("hex");
    const answer = (await ask(`Invite code your classmates must type to sign up. Press Enter to use "${suggestion}", type your own, or type "none" for no code.\n> `)).trim();
    values.set("INVITE_CODE", answer.toLowerCase() === "none" ? "" : answer || suggestion);
  }
  if (!existing.has("APP_URL")) {
    values.set("APP_URL", (await ask("Public address of the site once it is online (for example https://your-app.vercel.app). Press Enter to skip for now.\n> ")).trim().replace(/\/+$/, ""));
  }

  // 3. write .env from the template (comments are kept)
  const written = new Set<string>();
  const lines = template.map((line) => {
    const m = /^([A-Z0-9_]+)=/.exec(line);
    if (!m) return line;
    written.add(m[1]);
    return `${m[1]}=${values.get(m[1]) ?? ""}`;
  });
  for (const [key, value] of values) if (!written.has(key)) lines.push(`${key}=${value}`);
  writeFileSync(".env", lines.join("\n").replace(/\n*$/, "\n"));
  console.log("\nSaved .env (it stays on this computer; it is ignored by Git).");

  // 4. database tables
  if (skipMigrate) console.log("Skipped creating the database tables (--skip-migrate).");
  else {
    console.log("\nCreating the database tables…");
    const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32" });
    if (result.status !== 0) {
      console.log("\nCould not create the tables. Check DATABASE_URL in .env, then run: npm run db:deploy");
      process.exit(1);
    }
  }

  // 5. optional email test
  if (values.get("SMTP_USER") && !skipEmailTest) {
    const answer = (await ask(`\nSend a test email to ${values.get("SMTP_USER")} now? (y/n)\n> `)).trim().toLowerCase();
    if (answer.startsWith("y")) spawnSync("npm", ["run", "email:test"], { stdio: "inherit", shell: process.platform === "win32" });
  }

  console.log(`
Done. Next:
  1. npm run dev          -> open http://localhost:3000 and sign up (you are the first student).
  2. When you are ready to put it online for everyone, follow docs/DEPLOY_ONCE.md.
${values.get("INVITE_CODE") ? `\nYour classmates' invite code: ${values.get("INVITE_CODE")}\n` : ""}`);
  rl.close();
  process.exit(0);
}

main();
