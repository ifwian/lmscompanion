// Used by Vercel (it runs the "vercel-build" script if there is one).
// On a PRODUCTION deploy it first applies any new database migrations, then builds.
// If a migration fails, the build fails and the previous version stays online. Preview deploys never touch the database.
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production" && (process.env.DIRECT_URL || process.env.DATABASE_URL)) {
  console.log("Production deploy: applying database migrations…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log("Not a production deploy (or no database address): skipping migrations.");
}
run("npx", ["next", "build"]);
