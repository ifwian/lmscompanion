// Small display helpers (dates and "x min ago"). Times are shown in Philippine time.
export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "Never";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}

export function greeting(): string {
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Manila" }));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const TYPE_LABEL = {
  ACTIVITY: "Activity",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  ANNOUNCEMENT: "Announcement",
} as const;

export const STATUS_LABEL = {
  CONNECTED: "Connected",
  CHECKING: "Checking",
  AUTH_ERROR: "Authentication error",
  TEMPORARY_ERROR: "Temporary error",
  DISCONNECTED: "Disconnected",
} as const;
