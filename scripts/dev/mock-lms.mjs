// DEVELOPMENT TEST FIXTURE: a pretend e-GURO server. NOT the real e-GURO and NOT used by the app in production.
// It copies what the real site was seen doing in diagnostic reports (October 2026): login form with token_login_form,
// /app/login.php, /app/course_filter.php (a page listing classes in "var global_class = [...]"), and
// /app/table_course.php (JSON { last_page, total_record, data }) with filter_text / filter_type / page / size.
// Passing tests against this mock does NOT prove the real e-GURO works for every student.
import http from "node:http";

export function startMockLms(port = 4000) {
  const accounts = new Map(); // username -> { password, courses, items }
  const sessions = new Map(); // cookie value -> username
  const stats = { loginAttempts: {}, tableCalls: 0 };
  const mode = { down: false, breakFormat: false };

  const loginPage = `<html><body><form method="post" action="/app/login.php?formSubmitted=true">
    <input type="hidden" name="token_login_form" value="mock-token">
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
      if (cmd.addAccount) accounts.set(cmd.addAccount.username, { password: cmd.addAccount.password, courses: cmd.addAccount.courses ?? [], items: [] });
      if (cmd.addItem) accounts.get(cmd.addItem.username).items.push(cmd.addItem.item);
      if (cmd.addItems) accounts.get(cmd.addItems.username).items.push(...cmd.addItems.items);
      if (cmd.setLists) { const item = accounts.get(cmd.setLists.username).items.find((i) => i.id === cmd.setLists.id); item.lists = cmd.setLists.lists; }
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

    const username = userFor(req);

    if (url.pathname === "/app/main_student.php") {
      return username ? send(200, "text/html", "<html><body>Dashboard</body></html>") : send(200, "text/html", loginPage);
    }

    if (url.pathname === "/app/course_filter.php") {
      if (!username) return send(200, "text/html", loginPage);
      const classes = [{ teacher_class_student_id: 0, teacher_class_id: 0, student_id: 0, teacher_id: 0, class_name: "", subject_code: "ALL CLASS", subject_text: "", status: "" },
        ...accounts.get(username).courses.map((c) => ({ teacher_class_student_id: 1, student_id: 1, teacher_id: 1, status: "", ...c }))];
      return send(200, "text/html", `<html><body><script>var global_filter = 'ASSIGNED'; var global_filter_type = 'ALL'; var global_class_id = '0'; var global_class = ${JSON.stringify(classes)}; var x = 1;</script></body></html>`);
    }

    if (url.pathname === "/app/table_course.php") {
      if (!username) return send(200, "text/html", loginPage);
      stats.tableCalls += 1;
      if (mode.breakFormat) return send(200, "text/html", "<html><body>New layout!</body></html>");
      const filter = url.searchParams.get("filter_text");
      const type = url.searchParams.get("filter_type") ?? "";
      const page = Number(url.searchParams.get("page") ?? 1);
      const size = Number(url.searchParams.get("size") ?? 30);
      // Which list an item is in: ASSIGNED by default, or whatever the test sets with "lists".
      // DUE_TODAY repeats the first assigned item (tests de-duplication and "strongest status wins").
      const matching = accounts.get(username).items.filter((i) => type === "" || i.lmsType === type);
      const assigned = matching.filter((i) => (i.lists ?? ["ASSIGNED"]).includes("ASSIGNED"));
      const rowsAll = filter === "DUE_TODAY" ? assigned.slice(0, 1) : matching.filter((i) => (i.lists ?? ["ASSIGNED"]).includes(filter));
      // Row shape copied from the real reports. UNREAD rows have no mark_type (like the real site).
      const rows = rowsAll.slice((page - 1) * size, page * size).map((i) => ({
        class_exam_id: String(i.id), title: i.title, date_added: "2026-10-01 07:00:00", term: "2",
        teacher_class_id: String(i.course ?? accounts.get(username).courses[0]?.teacher_class_id ?? 0),
        exam_type: "1", submit_answer: i.submit ?? "1",
        date_deadline: i.due || "0000-00-00 00:00:00", from_date: "2026-10-01 08:00:00", to_date: i.due || "0000-00-00 00:00:00",
        ...(filter === "UNREAD" ? {} : { review_date: "2026-10-30", grade: null, status: "", mark_type: i.lmsType }),
      }));
      return send(200, "application/json; charset=utf-8", JSON.stringify({ last_page: Math.ceil(rowsAll.length / size), data: rows, total_record: rowsAll.length }));
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
