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
  maxUsersPerRun: () => intFromEnv("MAX_USERS_PER_RUN", 10, 1, 100),
  // Pause between students inside one run (milliseconds).
  delayBetweenUsersMs: () => intFromEnv("DELAY_BETWEEN_USERS_MS", 1000, 0, 60000),
  lmsBaseUrl: () => process.env.LMS_BASE_URL || "https://lms.ccc.edu.ph",
  // Public address of this app (used for the Settings link in emails). Optional.
  appUrl: () => (process.env.APP_URL ?? "").replace(/\/+$/, "") || null,
};
