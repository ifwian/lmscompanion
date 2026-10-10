// Looks for secrets that must never be committed. Run: npm run check:secrets (also runs in CI).
// It checks the files Git tracks (or every file if this is not a Git copy).
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".next", "generated", ".git", ".vercel", "backups"]);
// Lockfiles are skipped: they only hold integrity hashes, never credentials.
// skills-lock.json stores a SHA-256 of each agent-skill file (a "computedHash" key),
// which looks like a 64-hex key but is a content fingerprint, not a secret.
const SKIP_FILES = new Set(["package-lock.json", "skills-lock.json"]);
// Test-only values are written openly in the CI workflow; that file is allowed on purpose.
const ALLOWED = new Set([".github/workflows/ci.yml"]);

function listFiles() {
  try {
    return execSync("git ls-files", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  } catch {
    const out = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else out.push(path.relative(".", full).split(path.sep).join("/"));
      }
    };
    walk(".");
    return out;
  }
}

const RULES = [
  { name: "a real-looking database address with a password", re: /postgres(?:ql)?:\/\/[^\s:@/]+:(?!PASSWORD\b|pass\b|testpw\b|x\b|secretpw\b|p\b)[^\s@/]{6,}@(?!localhost|127\.0\.0\.1|HOST|host)[^\s/]+/i },
  { name: "a long hex key (32+ bytes)", re: /\b[0-9a-f]{64}\b/i },
  { name: "a private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "an AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "a filled-in SMTP_PASSWORD", re: /^SMTP_PASSWORD=\S{8,}/m },
  { name: "a filled-in AUTH_SECRET / ENCRYPTION_KEY / CRON_SECRET", re: /^(?:AUTH_SECRET|ENCRYPTION_KEY|CRON_SECRET)=\S{16,}/m },
];

const problems = [];
const files = listFiles();
for (const file of files) {
  const base = path.basename(file);
  if (SKIP_FILES.has(base) || ALLOWED.has(file)) continue;
  if (/^\.env/.test(base) && base !== ".env.example") problems.push(`${file}: an environment file is tracked. Remove it: git rm --cached ${file}`);
  if (/\.(png|jpg|jpeg|gif|zip|woff2?|ico)$/i.test(file)) continue;
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  for (const rule of RULES) if (rule.re.test(text)) problems.push(`${file}: looks like ${rule.name}`);
}

if (problems.length) {
  console.error(`Secret check FAILED (${problems.length}):\n` + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`Secret check passed: ${files.length} files scanned, nothing that looks like a secret.`);
