// Runs once when the server starts, and reports unexpected request errors.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { envProblems } = await import("./lib/env");
  for (const problem of envProblems()) console.warn(JSON.stringify({ level: "warn", scope: "startup", message: problem }));
}

// Called by Next.js for any error that was not handled (a crashed page or API route).
export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/log");
  await logError(`request:${context.routeType}`, error, { path: `${request.method} ${request.path}` });
}
