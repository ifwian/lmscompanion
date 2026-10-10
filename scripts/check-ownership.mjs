// Safety net for "one student must never see another student's data".
// Every database call on a student-owned table must mention userId (so it is filtered to the logged-in student),
// or carry a comment `// ownership: ok - <reason>` for system jobs that really work across students.
// A whole file can be marked with `// ownership: ok-file - <reason>` (used only for the owner summary).
// Run: npm run check:ownership   (also runs in CI, so a forgotten filter is caught before it ships)
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MODELS = ["activity", "note", "course", "notification", "lmsConnection", "notificationPreference", "authToken", "task", "telegramLink", "telegramLinkCode"];
const OPS = ["findMany", "findFirst", "findUnique", "findFirstOrThrow", "findUniqueOrThrow", "update", "updateMany", "delete", "deleteMany", "count", "aggregate", "groupBy", "upsert"];
const CALL = new RegExp(`(?:\\bdb|\\btx|getDb\\(\\))\\.(${MODELS.join("|")})\\.(${OPS.join("|")})\\(`, "g");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", "generated", "dev"].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function argsAt(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(openIndex, i + 1);
  }
  return text.slice(openIndex);
}

const problems = [];
let checked = 0;
for (const dir of ["app", "lib", "services"]) {
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    if (/ownership: ok-file/.test(text)) continue;
    for (const match of text.matchAll(CALL)) {
      checked++;
      const open = match.index + match[0].length - 1;
      const args = argsAt(text, open);
      const lineNumber = text.slice(0, match.index).split("\n").length;
      const lines = text.split("\n");
      const context = [lines[lineNumber - 2] ?? "", lines[lineNumber - 1] ?? ""].join("\n");
      const ok = /userId/.test(args) || /ownership: ok/.test(args) || /ownership: ok/.test(context);
      if (!ok) problems.push(`${file}:${lineNumber}  ${match[1]}.${match[2]}(...) has no userId filter`);
    }
  }
}

if (problems.length) {
  console.error(`Ownership check FAILED (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n` + problems.map((p) => "  - " + p).join("\n"));
  console.error('\nFix: add the student\'s userId to the query, or if it is a system job, add a comment: // ownership: ok - <why>');
  process.exit(1);
}
console.log(`Ownership check passed: ${checked} database calls on student-owned tables all filter by userId (or are marked as system jobs).`);
