// ALL e-GURO network code lives in this file. If e-GURO changes, this is the only file that should need edits.
//
// Flow (from the old prototype; NOT yet verified against the current site):
//   1. GET the login page and read its hidden form fields (including token_login_form)
//   2. POST them with username + password to /app/login.php?formSubmitted=true
//   3. Keep the cookies and call /app/course_filter.php (JSON) for each filter/type
//
// Politeness rules: honest User-Agent, a timeout on every request, a pause between requests,
// and a login is attempted ONCE per check (never retried here).
import { LmsAuthError, LmsFormatError, LmsTemporaryError } from "./errors";
import { parseActivityList } from "./parsers";
import type { LmsActivity, LmsCredentials } from "./types";

const USER_AGENT = "eGuroCompanion/1.0 (personal notification tool for students)";
const REQUEST_TIMEOUT_MS = 15_000;
const PAUSE_BETWEEN_REQUESTS_MS = 300;
const MAX_REDIRECTS = 5;

// ASSUMPTION (from the old prototype): these are the values course_filter.php understands.
// Only "new-looking" filters are used to keep the load on the college server small.
const FILTERS = ["ASSIGNED", "UNREAD"];
const TYPES = ["LESSON", "ACTIVITY_QUIZ", "ASSESSMENT", "QUESTIONNAIRE", "SUBMIT_ANSWER", "FILE_LESSON", "LINK"];

// Value for the login form's "agents" field (the old prototype sent browser details here).
// Verify what e-GURO really needs using the Milestone 4 network capture.
const AGENTS_FIELD_VALUE = JSON.stringify({ name: "eGuroCompanion", version: "1.0" });

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
  if ("agents" in hidden) hidden.agents = AGENTS_FIELD_VALUE;

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

async function fetchActivityList(session: LmsSession, filter: string, lmsType: string): Promise<LmsActivity[]> {
  const path = `/app/course_filter.php?filter_text=${encodeURIComponent(filter)}&type_text=${encodeURIComponent(lmsType)}`;
  const response = await request(session, path, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/plain, */*",
      Referer: `${session.baseUrl}/app/main_student.php`,
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
  return parseActivityList(json, lmsType);
}

// Reads every pending item the student can see and removes duplicates across filters.
export async function getActivities(session: LmsSession): Promise<LmsActivity[]> {
  const seen = new Map<string, LmsActivity>();
  for (const filter of FILTERS) {
    for (const lmsType of TYPES) {
      for (const item of await fetchActivityList(session, filter, lmsType)) {
        const key = `${item.lmsType}:${item.lmsActivityId ?? item.title}`;
        if (!seen.has(key)) seen.set(key, item);
      }
      await sleep(PAUSE_BETWEEN_REQUESTS_MS);
    }
  }
  return [...seen.values()];
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
