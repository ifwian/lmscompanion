// ALL e-GURO network code lives in this file. If e-GURO changes, this is the only file that should need edits.
//
// Flow (login confirmed on the real site; the data calls follow what the site's own page code does):
//   1. GET the login page and read its hidden form fields (including token_login_form)
//   2. POST them with username + password to /app/login.php?formSubmitted=true
//   3. Keep the cookies, load /app/course_filter.php (lists the student's classes), then ask
//      /app/table_course.php (JSON) for each filter, exactly like the page's table does
//
// Politeness rules: honest User-Agent, a timeout on every request, a pause between requests,
// and a login is attempted ONCE per check (never retried here).
import { LmsAuthError, LmsFormatError, LmsTemporaryError } from "./errors";
import { mergeItems, parseActivityPage, parseCoursesFromPage } from "./parsers";
import type { LmsActivity, LmsCourse, LmsCredentials } from "./types";

const USER_AGENT = "eGuroCompanion/1.0 (personal notification tool for students)";
const REQUEST_TIMEOUT_MS = 15_000;
const PAUSE_BETWEEN_REQUESTS_MS = 300;
const MAX_REDIRECTS = 5;

// The e-GURO dashboard cards link to these exact filter/type pairs (seen in a real report and screenshot):
//   "Activity & Quiz" cards = type LESSON, "Assessment" cards = type EXAM, "Missed" covers every type (empty type),
//   and "Unread" (type LESSON) is the unread lesson material.
const REQUESTS: { filter: "ASSIGNED" | "DUE_TODAY" | "MISSED" | "UNREAD"; type: string }[] = [
  { filter: "ASSIGNED", type: "LESSON" },
  { filter: "ASSIGNED", type: "EXAM" },
  { filter: "DUE_TODAY", type: "LESSON" },
  { filter: "DUE_TODAY", type: "EXAM" },
  { filter: "MISSED", type: "" },
  { filter: "UNREAD", type: "LESSON" },
];
const PAGE_SIZE = 50;
const MAX_PAGES = 6; // safety limit per list

export type LmsSession = { baseUrl: string; cookies: Map<string, string> };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LmsFormatError("LMS_BASE_URL is not a valid URL.");
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !isLocal) throw new LmsFormatError("LMS_BASE_URL must use https.");
  return url.origin;
}

function storeCookies(session: LmsSession, response: Response) {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) session.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader(session: LmsSession): string {
  return [...session.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

// One HTTP request with cookies, timeout and manual redirect following (staying on the LMS host).
async function request(session: LmsSession, path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  let url = new URL(path, session.baseUrl);
  let method = init.method ?? "GET";
  let body = init.body;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.origin !== session.baseUrl) throw new LmsFormatError("Unexpected redirect away from the LMS.");
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader(session), ...init.headers },
      });
    } catch {
      throw new LmsTemporaryError("Could not reach e-GURO.");
    }
    storeCookies(session, response);

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url);
      method = "GET";
      body = undefined;
      continue;
    }
    if (response.status === 429 || response.status >= 500 || response.status === 403) {
      throw new LmsTemporaryError(`e-GURO answered with status ${response.status}.`);
    }
    return response;
  }
  throw new LmsTemporaryError("Too many redirects from e-GURO.");
}

function hasPasswordInput(html: string): boolean {
  return /<input[^>]+name=["']?password["']?/i.test(html);
}

function readHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const tag of html.match(/<input[^>]*>/gi) ?? []) {
    if (!/type=["']?hidden["']?/i.test(tag)) continue;
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    fields[name] = tag.match(/value=["']([^"']*)["']/i)?.[1] ?? "";
  }
  return fields;
}

// Logs in once. Throws LmsAuthError only when e-GURO clearly shows the login form again.
export async function getLMSSession(baseUrl: string, credentials: LmsCredentials): Promise<LmsSession> {
  const session: LmsSession = { baseUrl: resolveBaseUrl(baseUrl), cookies: new Map() };

  const loginPage = await request(session, "/");
  const loginHtml = await loginPage.text();
  const hidden = readHiddenFields(loginHtml);
  if (!hidden.token_login_form) throw new LmsFormatError("Login page has no token_login_form field.");
  if ("agents" in hidden) hidden.agents = JSON.stringify({ name: "eGuroCompanion", version: "1.0" });

  const form = new URLSearchParams({
    ...hidden,
    username: credentials.username,
    password: credentials.password,
    submit: "login",
  });
  const response = await request(session, "/app/login.php?formSubmitted=true", {
    method: "POST",
    body: form.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${session.baseUrl}/` },
  });
  const afterHtml = await response.text();
  if (hasPasswordInput(afterHtml)) throw new LmsAuthError("e-GURO rejected the login.");
  return session;
}

const FILTER_PAGE = "/app/course_filter.php?filter_text=ASSIGNED&type_text=LESSON";

// The student's classes, read from the filter page (it lists them in a "global_class" variable).
// This page is also what the real site loads before its table asks for rows, so it is requested first.
export async function getCourses(session: LmsSession): Promise<LmsCourse[]> {
  const response = await request(session, FILTER_PAGE, { headers: { Referer: `${session.baseUrl}/app/main_student.php` } });
  const html = await response.text();
  if (hasPasswordInput(html)) throw new LmsAuthError("e-GURO session was not accepted.");
  return parseCoursesFromPage(html);
}

async function fetchFilter(session: LmsSession, filter: "ASSIGNED" | "DUE_TODAY" | "MISSED" | "UNREAD", type: string): Promise<LmsActivity[]> {
  const items: LmsActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const path = `/app/table_course.php?filter_text=${encodeURIComponent(filter)}&filter_type=${encodeURIComponent(type)}&page=${page}&size=${PAGE_SIZE}`;
    const response = await request(session, path, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/plain, */*",
        Referer: `${session.baseUrl}${FILTER_PAGE}`,
      },
    });
    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // HTML instead of JSON: either we got logged out, or the endpoint changed.
      if (hasPasswordInput(text)) throw new LmsAuthError("e-GURO session was not accepted.");
      throw new LmsFormatError("Expected JSON from e-GURO but got something else.");
    }
    const result = parseActivityPage(json, session.baseUrl, {
      requestType: type,
      status: filter === "UNREAD" ? null : filter,
      unread: filter === "UNREAD",
    });
    items.push(...result.items);
    // last_page was 0 even for lists that had rows, so a full page of rows also means "ask for the next page".
    if (result.rowCount < PAGE_SIZE && page >= result.lastPage) break;
    await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  }
  return items;
}

// Reads the lists the way the dashboard cards do and combines items that appear in more than one list.
export async function getActivities(session: LmsSession): Promise<LmsActivity[]> {
  const all: LmsActivity[] = [];
  for (const { filter, type } of REQUESTS) {
    all.push(...(await fetchFilter(session, filter, type)));
    await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  }
  return mergeItems(all);
}

// ---------------------------------------------------------------------------------------------
// Read-only helper for scripts/diagnose-lms.ts. It lets the diagnostic look at what e-GURO really
// answers (status, type, final address, body) using the SAME cookies and politeness rules as the app.
// GET only, same host only. Not used by the app itself.
export async function diagnosticGet(session: LmsSession, path: string, ajax = false) {
  const response = await request(session, path, {
    headers: ajax ? { "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/plain, */*" } : {},
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    finalLocation: response.headers.get("location"),
    body: await response.text(),
  };
}

export async function diagnosticLoginPage(baseUrl: string) {
  const session: LmsSession = { baseUrl: resolveBaseUrl(baseUrl), cookies: new Map() };
  const page = await diagnosticGet(session, "/");
  const fields = (page.body.match(/<input[^>]*>/gi) ?? []).map((tag) => ({
    name: tag.match(/name=["']([^"']+)["']/i)?.[1] ?? "(no name)",
    type: tag.match(/type=["']?([a-z]+)["']?/i)?.[1] ?? "text",
  }));
  const formAction = page.body.match(/<form[^>]*action=["']([^"']*)["']/i)?.[1] ?? null;
  return { status: page.status, fields, formAction };
}

// Read-only POST for the diagnostic: the calendar page itself asks ajax_cal_event.php with action=VIEW.
// Only that one address and action are allowed here, so the diagnostic can never change anything.
export async function diagnosticPostCalendarView(session: LmsSession, start: string, end: string) {
  const response = await request(session, "/app/ajax_cal_event.php", {
    method: "POST",
    body: new URLSearchParams({ start, end, action: "VIEW" }).toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${session.baseUrl}/app/calendar_events.php`,
    },
  });
  return { status: response.status, contentType: response.headers.get("content-type") ?? "", body: await response.text() };
}
