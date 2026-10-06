// Settings that can be changed without touching code. All have safe defaults.
function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export const config = {
  // How often each student's LMS is checked (minutes). Do not set this very low: it loads the college server.
  checkIntervalMinutes: () => intFromEnv("CHECK_INTERVAL_MINUTES", 15, 5, 1440),
  // How many students one checker run handles (keeps a run inside the serverless time limit).
  maxUsersPerRun: () => intFromEnv("MAX_USERS_PER_RUN", 25, 1, 200),
  // How many students are checked at the same time inside one run. Keep it small: it is gentle on the college server.
  checkConcurrency: () => intFromEnv("CHECK_CONCURRENCY", 3, 1, 5),
  // Optional: a code classmates must type to sign up. Empty = anyone with the address can register.
  inviteCode: () => (process.env.INVITE_CODE ?? "").trim() || null,
  // Pause between students inside one run (milliseconds).
  delayBetweenUsersMs: () => intFromEnv("DELAY_BETWEEN_USERS_MS", 500, 0, 60000),
  lmsBaseUrl: () => process.env.LMS_BASE_URL || "https://lms.ccc.edu.ph",
  // Public address of this app (used for the Settings link in emails). Optional.
  appUrl: () => (process.env.APP_URL ?? "").replace(/\/+$/, "") || null,
};

// The public address used in links inside emails (confirm email, reset password).
// In production this MUST come from APP_URL: building links from the request's Host header would let an
// attacker make the app send people links to a site they control.
export function linkBase(request: Request): string | null {
  const configured = config.appUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return null;
}