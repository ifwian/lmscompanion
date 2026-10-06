// Run:  npm run lms:diagnose          (add --show-values to also print text values)
// Logs in to YOUR e-GURO account ONCE, then only READS a handful of pages, and writes a report about the
// *shape* of what the college website answers, so the app's e-GURO code (services/lms) can be fixed
// without guessing.
//
// Privacy: the password is typed into this terminal (hidden), used once, and never saved.
// The report shows structure only: addresses, field names, column labels, tag/class names and sizes.
// Long text (course names, titles, people) is masked unless you add --show-values.
// The report is saved to diagnose-output.txt (ignored by Git). READ IT before sharing it.
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parse, type HTMLElement } from "node-html-parser";
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

// ---------- helpers that keep the report free of personal text ----------
function mask(text: string): string {
  if (showValues) return text;
  return text
    // Long quoted text is hidden, but addresses (they contain ".php" or start with "/") are kept: they are what we need.
    .replace(/(["'`])((?:(?!\1)[^\\\n]){25,})\1/g, (m, q: string, body: string) => (/\.php|^\//.test(body) ? m : `${q}…(${body.length} chars)${q}`))
    .replace(/\d{6,}/g, "#");
}

function describeJson(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length === 0 ? "[] (empty list)" : [`list of ${value.length}:`, describeJson(value[0], depth + 1)];
  if (value && typeof value === "object") {
    if (depth > 3) return "{...}";
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, describeJson(v, depth + 1)]));
  }
  if (typeof value === "string") return showValues ? value.slice(0, 80) : `string(${value.length})`;
  return showValues ? value : typeof value;
}

function chain(node: HTMLElement | null, depth = 6): string[] {
  const result: string[] = [];
  let current: HTMLElement | null = node;
  while (current && current.tagName && depth-- > 0) {
    const id = current.getAttribute("id");
    const cls = (current.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
    result.push(`${current.tagName.toLowerCase()}${id ? "#" + id : ""}${cls ? "." + cls : ""}`);
    current = current.parentNode as HTMLElement | null;
  }
  return result;
}

function inlineScripts(html: string): string[] {
  return parse(html, { blockTextElements: { script: true, style: false, noscript: true, pre: true } })
    .querySelectorAll("script")
    .filter((s) => !s.getAttribute("src"))
    .map((s) => s.rawText);
}

const NEEDLES = ["course_filter", "calendar_events", "notif.php", "ajaxURL", "ajaxConfig", "$.ajax", "$.post", "$.get(", "fetch(", "main_student_class", "url:"];

function codeSnippets(scripts: string[]): string[] {
  const found = new Set<string>();
  for (const script of scripts) {
    for (const needle of NEEDLES) {
      let from = 0;
      let count = 0;
      while (count < 3) {
        const at = script.indexOf(needle, from);
        if (at < 0) break;
        found.add(mask(script.slice(Math.max(0, at - 120), at + 220).replace(/\s+/g, " ")));
        from = at + needle.length;
        count++;
      }
    }
  }
  return [...found].slice(0, 40);
}

function tableFieldNames(scripts: string[]): string[] {
  const names = new Set<string>();
  for (const script of scripts) for (const m of script.matchAll(/\bfield\s*:\s*["']([A-Za-z0-9_]+)["']/g)) names.add(m[1]);
  return [...names].sort();
}

const LABEL_WORDS = /pending|due|deadline|upcoming|to ?do|missed|assigned|unread|quiz|assignment|activit|announce|lesson|exam|submi|task/i;

function describePage(html: string) {
  const root = parse(html, { blockTextElements: { script: true, style: false, noscript: true, pre: true } });
  const anchors: Record<string, number> = {};
  let firstClassAnchor: HTMLElement | null = null;
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    if (!/\.php/.test(href) || /^(https?:)?\/\/(?!lms\.ccc\.edu\.ph)/.test(href)) continue;
    let signature: string;
    try {
      const url = new URL(href, baseUrl);
      signature = `${url.pathname}?${[...url.searchParams.keys()].sort().join("&")}`;
    } catch {
      continue;
    }
    anchors[signature] = (anchors[signature] ?? 0) + 1;
    if (/main_student_class/.test(signature) && !firstClassAnchor) firstClassAnchor = a;
  }
  const tables = root.querySelectorAll("table").map((t) => ({
    where: chain(t, 4),
    rows: t.querySelectorAll("tr").length,
    headerLabels: t.querySelectorAll("th").map((th) => th.text.trim()).filter((x) => x && x.length <= 30).slice(0, 15),
  }));
  const labels = new Set<string>();
  for (const el of root.querySelectorAll("button, option, th, label, h1, h2, h3, h4, h5, h6, [role=tab], .nav-link, .tab, .badge")) {
    const text = el.text.replace(/\s+/g, " ").trim();
    if (text && text.length <= 40 && LABEL_WORDS.test(text)) labels.add(text);
  }
  const dataAttributes = new Set<string>();
  for (const el of root.querySelectorAll("*")) for (const key of Object.keys(el.attributes)) if (key.startsWith("data-")) dataAttributes.add(key);
  const scripts = inlineScripts(html);
  return {
    length: html.length,
    title: showValues ? root.querySelector("title")?.text.trim() : "(hidden)",
    linksToPhpPages: Object.fromEntries(Object.entries(anchors).sort((a, b) => b[1] - a[1]).slice(0, 25)),
    firstClassLinkAncestors: chain(firstClassAnchor),
    tables: tables.slice(0, 6),
    uiLabelsMentioningTasks: [...labels].sort().slice(0, 40),
    dataAttributeNames: [...dataAttributes].sort().slice(0, 40),
    tableColumnFieldNamesInScripts: tableFieldNames(scripts),
    codeNearDataCalls: codeSnippets(scripts),
  };
}

async function probe(session: Awaited<ReturnType<typeof getLMSSession>>, label: string, path: string, ajax: boolean) {
  out(`\n${label}  GET ${path}`);
  try {
    const result = await diagnosticGet(session, path, ajax);
    const summary: Record<string, unknown> = { status: result.status, contentType: result.contentType, length: result.body.length };
    try {
      summary.json = describeJson(JSON.parse(result.body));
    } catch {
      summary.notJson = true;
      if (/<html|<!doctype/i.test(result.body)) Object.assign(summary, { page: describePage(result.body) });
      else summary.textStart = showValues ? result.body.slice(0, 200) : `(hidden, ${result.body.length} chars)`;
    }
    out(JSON.stringify(summary, null, 2));
  } catch (error) {
    out(`Request failed: ${(error as Error).name}: ${(error as Error).message}`);
  }
}

async function main() {
  out(`e-GURO diagnostic v2 — ${new Date().toISOString()}`);
  out(`Site: ${baseUrl}   (values ${showValues ? "SHOWN" : "hidden"})`);

  out("\n1) Login page");
  out(JSON.stringify(await diagnosticLoginPage(baseUrl), null, 2));

  const username = process.env.LMS_USERNAME || (await ask("e-GURO username: ", false));
  const password = process.env.LMS_PASSWORD || (await ask("e-GURO password (hidden): ", true));
  if (!username || !password) throw new Error("Username and password are required.");

  out("\n2) Login (one attempt)");
  let session;
  try {
    session = await getLMSSession(baseUrl, { username, password });
    out(`Result: accepted. Cookie names: ${[...session.cookies.keys()].join(", ")}`);
  } catch (error) {
    out(`Result: FAILED (${(error as Error).name}: ${(error as Error).message})`);
    if (error instanceof LmsAuthError) out("e-GURO rejected the login. Check your username and password in a normal browser first.");
    return;
  }

  const pause = () => new Promise((r) => setTimeout(r, 600));
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  // The student's home page: how classes are linked, what the page script calls.
  await probe(session, "3) Home page", "/app/main_student.php", false);
  await pause();
  // The old prototype's address: it answers with a full page, so look at that page's structure and code.
  await probe(session, "4) course_filter.php page", "/app/course_filter.php", false);
  await pause();
  // Candidates that look like data feeds (a calendar feed usually lists due dates; notif.php looks like notifications).
  await probe(session, "5) Calendar feed", `/app/calendar_events.php?start=${iso(start)}&end=${iso(end)}`, true);
  await pause();
  await probe(session, "6) Notifications", "/app/notif.php", true);

  out("\nDone. Nothing was changed on e-GURO (only reads).");
}

main()
  .catch((error) => out(`Diagnostic stopped: ${(error as Error).message}`))
  .finally(() => {
    writeFileSync("diagnose-output.txt", lines.join("\n") + "\n");
    console.log("\nSaved to diagnose-output.txt. Open it and check it before sharing.");
    process.exit(0);
  });
