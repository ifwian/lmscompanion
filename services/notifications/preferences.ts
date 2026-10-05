import type { ActivityType, NotificationPreference } from "../../generated/prisma/client";

// Maps an activity type to the matching on/off switch in the student's settings.
export function isTypeEnabled(prefs: NotificationPreference | null, type: ActivityType): boolean {
  // No row yet = defaults (everything on).
  if (!prefs) return true;
  switch (type) {
    case "QUIZ":
      return prefs.quizzesEnabled;
    case "ASSIGNMENT":
      return prefs.assignmentsEnabled;
    case "ANNOUNCEMENT":
      return prefs.announcementsEnabled;
    default:
      return prefs.activitiesEnabled;
  }
}
