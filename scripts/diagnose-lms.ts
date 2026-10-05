// Run:  npm run lms:diagnose
// Logs in to YOUR e-GURO account ONCE and reports the *shape* of what the college website answers,
// so the app's e-GURO code (services/lms) can be fixed without guessing.
//
// Privacy: the password is typed into this terminal (hidden), used once, and never saved.
// The report shows page structure only: addresses, field names, types and lengths. Text such as
// course names, titles and people's names is hidden unless you add --show-values.
// The report is saved to diagnose-output.txt (ignored by Git). Read it before sharing it.
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { diagnosticGet, diagnosticLoginPage, getLMSSession } from "../services/lms/client";
import { LmsAuthError } from "../services/lms/errors";

const showValues = process.argv.includes("--show-values");
const baseUrl = process.env.LMS_BASE_URL || "https://lms.ccc.edu.ph";
const lines: string[] = [];
function out(text = "") {
  console.log(text);
  lines.push(text);
}

function ask(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Hide typed characters.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

// Describe JSON by its keys and value types only (strings become string(length)).
function describeJson(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length === 0 ? "[] (empty list)" : [`list of ${value.length}:`, describeJson(value[0], depth + 1)];
  if (value && typeof value === "object") {
    if (depth > 3) return "{...}";
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, describeJson(v, depth + 1)]));
  }
  if (typeof value === "string") return showValues ? value.slice(0, 80) : `string(${value.length})`;
  return showValues ? value : typeof value;
}

// .php / .json / .ajax style addresses mentioned in a page. These show where e-GURO loads its data from.
function findEndpoints(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/["'(]((?:\.{0,2}\/)?(?:app\/)?[A-Za-z0-9_\-/]+\.php(?:\?[A-Za-z0-9_=&%\-\[\]]*)?)["')]/g)) {
    found.add(match[1].replace(/=[^&]*/g, "=…"));
  }
  return [...found].sort().slice(0, 60);
}

function describeHtml(body: string) {
  const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  return {
    length: body.length,
    title: showValues ? title : title ? `(hidden, ${title.length} chars)` : "(none)",
    hasPasswordInput: /<input[^>]+name=["']?password["']?/i.test(body),
    hasLogoutLink: /logout|log-out|sign.?out/i.test(body),
    scriptFiles: [...body.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((src) => !/^https?:\/\//i.test(src) || src.startsWith(baseUrl)).slice(0, 25),
  };
}

async function main() {
  out(`e-GURO diagnostic — ${new Date().toISOString()}`);
  out(`Site: ${baseUrl}   (values ${showValues ? "SHOWN" : "hidden"})`);
  out("");

  out("1) Login page");
  const login = await diagnosticLoginPage(baseUrl);
  out(JSON.stringify(login, null, 2));

  const username = process.env.LMS_USERNAME || (await ask("e-GURO username: ", false));
  const password = process.env.LMS_PASSWORD || (await ask("e-GURO password (hidden): ", true));
  if (!username || !password) throw new Error("Username and password are required.");

  out("\n2) Login (one attempt)");
  let session;
  try {
    session = await getLMSSession(baseUrl, { username, password });
    out("Result: accepted (the login form was not shown again).");
    out(`Cookie names received: ${[...session.cookies.keys()].join(", ") || "(none)"}`);
  } catch (error) {
    out(`Result: FAILED (${(error as Error).name}: ${(error as Error).message})`);
    out(error instanceof LmsAuthError ? "e-GURO rejected the login. Check your username and password in a normal browser first." : "");
    return;
  }

  const pause = () => new Promise((r) => setTimeout(r, 500));
  const pages = ["/app/main_student.php", "/app/index.php", "/app/"];
  const seenEndpoints = new Set<string>();

  for (const path of pages) {
    out(`\n3) GET ${path}`);
    const page = await diagnosticGet(session, path);
    out(JSON.stringify({ status: page.status, contentType: page.contentType, ...describeHtml(page.body) }, null, 2));
    findEndpoints(page.body).forEach((e) => seenEndpoints.add(e));
    // Look inside this site's own script files for data addresses (these usually hold the real endpoints).
    for (const src of describeHtml(page.body).scriptFiles.slice(0, 12)) {
      await pause();
      try {
        const script = await diagnosticGet(session, src);
        findEndpoints(script.body).forEach((e) => seenEndpoints.add(e));
      } catch {
        /* ignore scripts that fail to load */
      }
    }
    await pause();
  }

  out("\n4) Data addresses mentioned in the pages and scripts (names only)");
  out([...seenEndpoints].sort().join("\n") || "(none found)");

  out("\n5) The old prototype's list address");
  const list = await diagnosticGet(session, "/app/course_filter.php?filter_text=ASSIGNED&type_text=ACTIVITY_QUIZ", true);
  const summary: Record<string, unknown> = { status: list.status, contentType: list.contentType, length: list.body.length };
  try {
    summary.json = describeJson(JSON.parse(list.body));
  } catch {
    Object.assign(summary, { notJson: true, ...describeHtml(list.body) });
  }
  out(JSON.stringify(summary, null, 2));

  out("\nDone. Nothing was changed on e-GURO (only reads).");
}

main()
  .catch((error) => out(`Diagnostic stopped: ${(error as Error).message}`))
  .finally(() => {
    writeFileSync("diagnose-output.txt", lines.join("\n") + "\n");
    console.log("\nSaved to diagnose-output.txt. Open it and check it before sharing.");
    process.exit(0);
  });
