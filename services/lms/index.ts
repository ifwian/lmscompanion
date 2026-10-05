// The only entry point the rest of the app uses for e-GURO.
import { config } from "@/lib/config";
import { getActivities, getLMSSession, type LmsSession } from "./client";
import type { LmsActivity, LmsCourse, LmsCredentials } from "./types";

export type { LmsActivity, LmsCourse, LmsCredentials, LmsSession };
export { LmsAuthError, LmsFormatError, LmsTemporaryError } from "./errors";

// What we can really read from e-GURO today. The UI uses this to explain empty pages honestly.
// Courses and announcements need an endpoint that has not been verified yet (see docs/MANUAL_STEPS.md).
export const LMS_CAPABILITIES = { activities: true, courses: false, announcements: false } as const;

export function connect(credentials: LmsCredentials): Promise<LmsSession> {
  return getLMSSession(config.lmsBaseUrl(), credentials);
}

export async function getCourses(_session: LmsSession): Promise<LmsCourse[]> {
  return []; // not supported yet: no verified source for course names
}

export async function getAnnouncements(_session: LmsSession): Promise<LmsActivity[]> {
  return []; // not supported yet: no verified announcements endpoint
}

export { getActivities };
