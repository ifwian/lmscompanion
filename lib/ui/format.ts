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

// e-GURO calls EXAM items "Assessment". We store them as the QUIZ type, but show the site's own word.
export function typeLabel(type: keyof typeof TYPE_LABEL, lmsType?: string | null, isMaterial?: boolean): string {
  if (isMaterial) return "Lesson";
  return lmsType === "EXAM" ? "Assessment" : TYPE_LABEL[type];
}

export const PENDING_LABEL: Record<string, string> = { MISSED: "Missed", DUE_TODAY: "Due today", ASSIGNED: "Assigned" };
const PENDING_RANK: Record<string, number> = { MISSED: 0, DUE_TODAY: 1, ASSIGNED: 2 };

// Pending list order: missed first, then due today, then assigned; inside each group the soonest deadline first.
export function sortPending<T extends { lmsStatus: string | null; dueDate: Date | null; postedAt: Date | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rank = (PENDING_RANK[a.lmsStatus ?? ""] ?? 9) - (PENDING_RANK[b.lmsStatus ?? ""] ?? 9);
    if (rank !== 0) return rank;
    const aDue = a.dueDate?.getTime() ?? Infinity;
    const bDue = b.dueDate?.getTime() ?? Infinity;
    if (aDue !== bDue) return aDue - bDue;
    return (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
  });
}

// "in 3 days", "in 5 hr", "2 days overdue"
export function dueIn(date: Date | null | undefined): string {
  if (!date) return "";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const text = hours < 1 ? "under 1 hr" : hours < 48 ? `${hours} hr` : `${Math.round(hours / 24)} days`;
  return diff >= 0 ? `due in ${text}` : `${text} overdue`;
}
