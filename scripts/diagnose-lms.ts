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
import { diagnosticGet, diagnosticLoginPage, diagnosticPostCalendarView, getLMSSession } from "../services/lms/client";
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

const NEEDLES = ["base_url", "global_filter", "global_filter_type", "ajaxURL", "ajaxParams", "ajaxResponse", "paginationSize", "last_page", "teacher_class_id", "class_exam_id"];

function codeSnippets(scripts: string[]): string[] {
  const found = new Set<string>();
  for (const script of scripts) {
    for (const needle of NEEDLES) {
      let from = 0;
      let count = 0;
      while (count < 2) {
        const at = script.indexOf(needle, from);
        if (at < 0) break;
        found.add(mask(script.slice(Math.max(0, at - 100), at + 260).replace(/\s+/g, " ")));
        from = at + needle.length;
        count++;
      }
    }
  }
  return [...found].slice(0, 28);
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

// ---------- v3: follow the page's own data calls ----------
const DATE_KEY = /date|time|created|start|end|due/i;
const FREE_TEXT_KEY = /name|title|log|desc|user|email|message|text|teacher|subject|(^|_)id$|_id_|token/i;

function digitsToNines(text: string) {
  return text.replace(/\d/g, "9");
}

// Describes a list of rows: field names, value types/lengths, date formats and short enumerations (like LESSON / EXAM).
function describeRows(rows: unknown[]) {
  const first = (rows[0] ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const enums: Record<string, string[]> = {};
  const dateFormats: Record<string, string[]> = {};
  for (const key of Object.keys(first)) {
    const value = first[key];
    fields[key] = typeof value === "string" ? `string(${value.length})` : value === null ? "null" : typeof value;
    const values = rows.map((row) => (row as Record<string, unknown>)[key]).filter((v) => typeof v === "string" || typeof v === "number") as (string | number)[];
    if (DATE_KEY.test(key)) {
      dateFormats[key] = [...new Set(values.map((v) => digitsToNines(String(v))))].slice(0, 3);
    } else if (!FREE_TEXT_KEY.test(key)) {
      const distinct = [...new Set(values.map(String))];
      if (distinct.length > 0 && distinct.length <= 12 && distinct.every((v) => v.length <= 24 && !/^\d{5,}$/.test(v))) enums[key] = distinct;
    }
  }
  return { rowCount: rows.length, fields, dateFormats, shortValueSets: enums };
}

function describeAny(body: string) {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { notJson: true, length: body.length, looksLikeHtml: /<html|<!doctype/i.test(body), start: showValues ? body.slice(0, 160) : "(hidden)" };
  }
  const rows = Array.isArray(json) ? json : Array.isArray((json as { data?: unknown })?.data) ? ((json as { data: unknown[] }).data) : null;
  const topLevel: Record<string, unknown> = {};
  if (json && typeof json === "object" && !Array.isArray(json)) {
    for (const [k, v] of Object.entries(json)) topLevel[k] = typeof v === "number" ? v : Array.isArray(v) ? `list(${v.length})` : typeof v;
  }
  return { json: true, topLevel, rows: rows ? describeRows(rows) : "(no list found)" };
}

async function safeGet(session: Awaited<ReturnType<typeof getLMSSession>>, path: string, ajax: boolean) {
  try {
    return await diagnosticGet(session, path, ajax);
  } catch (error) {
    out(`Request failed for ${path.split("?")[0]}: ${(error as Error).name}`);
    return null;
  }
}

function literalValues(scripts: string[], name: string): string[] {
  const found = new Set<string>();
  for (const script of scripts) {
    for (const m of script.matchAll(new RegExp(`\\b${name}\\s*[=:]\\s*([^;\\n]{0,140})`, "g"))) found.add(mask(m[1].trim()));
  }
  return [...found].slice(0, 6);
}

async function main() {
  out(`e-GURO diagnostic v4 — ${new Date().toISOString()}`);
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

  // 3) Which filter links does the home page offer?
  out("\n3) Filter links on the home page (short values only)");
  const home = await safeGet(session, "/app/main_student.php", false);
  const combos: { text: string; type: string }[] = [];
  if (home) {
    const root = parse(home.body);
    for (const a of root.querySelectorAll("a")) {
      const href = a.getAttribute("href") ?? "";
      if (!/course_filter\.php\?/.test(href)) continue;
      try {
        const url = new URL(href, `${baseUrl}/app/`);
        const text = url.searchParams.get("filter_text") ?? "";
        const type = url.searchParams.get("type_text") ?? "";
        if (text.length <= 30 && type.length <= 30 && !combos.some((c) => c.text === text && c.type === type)) combos.push({ text, type });
      } catch {
        /* ignore odd links */
      }
    }
  }
  out(JSON.stringify(combos, null, 2));
  const chosen = combos[0] ?? { text: "ASSIGNED", type: "" };
  await pause();

  // 4) The filter page: how it sets its filter variables and where its table loads data from.
  out(`\n4) course_filter.php page (filter_text=${chosen.text}, type_text=${chosen.type})`);
  const pagePath = `/app/course_filter.php?filter_text=${encodeURIComponent(chosen.text)}&type_text=${encodeURIComponent(chosen.type)}`;
  const page = await safeGet(session, pagePath, false);
  const candidates = new Set<string>();
  if (page) {
    const scripts = inlineScripts(page.body);
    out(JSON.stringify({
      globalFilter: literalValues(scripts, "global_filter"),
      globalFilterType: literalValues(scripts, "global_filter_type"),
      baseUrl: literalValues(scripts, "base_url"),
      tableFieldNames: tableFieldNames(scripts),
      codeNearTableSetup: codeSnippets(scripts),
    }, null, 2));
    for (const script of scripts) {
      for (const m of script.matchAll(/\b(?:base_url\s*=|ajaxURL\s*:)\s*["']([^"']+\.php[^"']*)["']/g)) candidates.add(m[1]);
    }
  }
  await pause();

  // 5) Ask the table address with the exact pairs the dashboard cards use, plus "ALL", and show what the rows look like.
  out("\n5) Table data address(es) found in the page code");
  out(JSON.stringify([...candidates].map((c) => mask(c.replace(/\?.*$/, ""))), null, 2));
  const tableAddress = [...candidates].map((c) => new URL(c.replace(/\?.*$/, ""), `${baseUrl}/app/`)).find((u) => u.origin === new URL(baseUrl).origin);
  if (tableAddress) {
    const pairs = [
      ["ASSIGNED", "LESSON"], ["ASSIGNED", "EXAM"], ["ASSIGNED", "ALL"], ["DUE_TODAY", "LESSON"],
      ["DUE_TODAY", "EXAM"], ["MISSED", ""], ["UNREAD", "LESSON"],
    ];
    for (const [filter, type] of pairs) {
      const path = `${tableAddress.pathname}?filter_text=${filter}&filter_type=${encodeURIComponent(type)}&page=1&size=${filter === "UNREAD" ? 5 : 30}`;
      out(`\nGET ${tableAddress.pathname}  filter_text=${filter}  filter_type=${type === "" ? "(empty)" : type}`);
      const result = await safeGet(session, path, true);
      if (result) out(JSON.stringify({ status: result.status, ...describeAny(result.body) }, null, 2));
      await pause();
    }
  }

  // 6) The calendar page loads its events with a POST (action VIEW). Same call the page makes.
  out("\n6) Calendar events (same request the calendar page makes)");
  const today = new Date();
  const iso = (d: Date) => `${d.toISOString().slice(0, 10)}T00:00:00+08:00`;
  try {
    const cal = await diagnosticPostCalendarView(session, iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), iso(new Date(today.getFullYear(), today.getMonth() + 3, 0)));
    out(JSON.stringify({ status: cal.status, contentType: cal.contentType, ...describeAny(cal.body) }, null, 2));
  } catch (error) {
    out(`Request failed: ${(error as Error).name}`);
  }
  await pause();

  // 7) The notifications table (address taken from the first report).
  out("\n7) Notifications table");
  const notif = await safeGet(session, "/app/table/notif_table.php?page=1&size=10", true);
  if (notif) out(JSON.stringify({ status: notif.status, contentType: notif.contentType, ...describeAny(notif.body) }, null, 2));

  out("\nDone. Nothing was changed on e-GURO (only reads).");
}

main()
  .catch((error) => out(`Diagnostic stopped: ${(error as Error).message}`))
  .finally(() => {
    writeFileSync("diagnose-output.txt", lines.join("\n") + "\n");
    console.log("\nSaved to diagnose-output.txt. Open it and check it before sharing.");
    process.exit(0);
  });
