import { SMTPServer } from "smtp-server";
const srv = new SMTPServer({ disabledCommands: ["STARTTLS"], allowInsecureAuth: true,
  onAuth(auth, _s, cb) { if (auth.username === "me@example.com" && auth.password === "abcdefghijklmnop") cb(null, { user: 1 }); else cb(new Error("Invalid login")); },
  onData(stream, _s, cb) { let d = ""; stream.on("data", (c) => (d += c)); stream.on("end", () => { console.log("RECEIVED subject:", /Subject: (.*)/.exec(d)?.[1]); cb(); }); } });
srv.listen(2526, () => console.log("smtp up"));
