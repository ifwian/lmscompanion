// DEVELOPMENT TEST FIXTURE: a pretend e-GURO server. NOT the real e-GURO and NOT used by the app in production.
// It copies the request/response shape of the OLD PROTOTYPE (login form with token_login_form, /app/login.php,
// /app/course_filter.php returning JSON), so we can test duplicate detection, emails and error handling offline.
// Passing tests against this mock does NOT prove the real e-GURO works. See docs/MANUAL_STEPS.md.
import http from "node:http";

export function startMockLms(port = 4000) {
  const accounts = new Map(); // username -> { password, items: [{ lmsType, id, title, due }] }
  const sessions = new Map(); // cookie value -> username
  const stats = { loginAttempts: {}, listCalls: 0 };
  const mode = { down: false, breakFormat: false };

  const loginPage = `<html><body><form method="post" action="/app/login.php?formSubmitted=true">
    <input type="hidden" name="token_login_form" value="mock-token">
    <input type="hidden" name="agents" value="">
    <input type="text" name="username"><input type="password" name="password">
    <button name="submit" value="login">LOGIN</button></form></body></html>`;

  const readBody = (req) => new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });
  const userFor = (req) => {
    const m = /sid=([^;]+)/.exec(req.headers.cookie ?? "");
    return m ? sessions.get(m[1]) : undefined;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const send = (status, type, body, headers = {}) => { res.writeHead(status, { "Content-Type": type, ...headers }); res.end(body); };

    // ---- test control endpoints (not part of the pretend LMS) ----
    if (url.pathname === "/__admin") {
      const cmd = JSON.parse((await readBody(req)) || "{}");
      if (cmd.addAccount) accounts.set(cmd.addAccount.username, { password: cmd.addAccount.password, items: [] });
      if (cmd.addItem) accounts.get(cmd.addItem.username).items.push(cmd.addItem.item);
      if (cmd.setPassword) accounts.get(cmd.setPassword.username).password = cmd.setPassword.password;
      if (cmd.down !== undefined) mode.down = cmd.down;
      if (cmd.breakFormat !== undefined) mode.breakFormat = cmd.breakFormat;
      return send(200, "application/json", JSON.stringify({ stats }));
    }
    if (mode.down) return send(503, "text/plain", "maintenance");

    if (url.pathname === "/" && req.method === "GET") return send(200, "text/html", loginPage);

    if (url.pathname === "/app/login.php" && req.method === "POST") {
      const form = new URLSearchParams(await readBody(req));
      const username = form.get("username") ?? "";
      stats.loginAttempts[username] = (stats.loginAttempts[username] ?? 0) + 1;
      const account = accounts.get(username);
      if (form.get("token_login_form") === "mock-token" && account && account.password === form.get("password")) {
        const sid = Math.random().toString(36).slice(2);
        sessions.set(sid, username);
        return send(302, "text/html", "", { Location: "/app/main_student.php", "Set-Cookie": `sid=${sid}; Path=/; HttpOnly` });
      }
      return send(200, "text/html", loginPage); // wrong login shows the form again
    }

    if (url.pathname === "/app/main_student.php") {
      return userFor(req) ? send(200, "text/html", "<html><body>Dashboard</body></html>") : send(200, "text/html", loginPage);
    }

    if (url.pathname === "/app/course_filter.php") {
      const username = userFor(req);
      if (!username) return send(200, "text/html", loginPage);
      stats.listCalls += 1;
      if (mode.breakFormat) return send(200, "text/html", "<html><body>New layout!</body></html>");
      const filter = url.searchParams.get("filter_text");
      const type = url.searchParams.get("type_text");
      const data = filter === "ASSIGNED"
        ? accounts.get(username).items.filter((i) => i.lmsType === type).map((i) => ({ class_exam_id: i.id, title: i.title, mark_type: i.lmsType, from_date: "2026-10-01 08:00:00", to_date: i.due ?? "" }))
        : [];
      return send(200, "application/json", JSON.stringify({ data }));
    }
    send(404, "text/plain", "not found");
  });

  return new Promise((resolve) => server.listen(port, () => resolve({ server, port })));
}

// Run directly: node scripts/dev/mock-lms.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await startMockLms(Number(process.env.PORT ?? 4000));
  console.log(`MOCK e-GURO (development only) listening on http://localhost:${port}`);
}
