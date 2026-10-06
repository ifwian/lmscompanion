// The shapes the rest of the app uses. Nothing outside services/lms knows about e-GURO's raw responses.
export type ActivityKind = "ACTIVITY" | "QUIZ" | "ASSIGNMENT" | "ANNOUNCEMENT";

export type LmsCourse = {
  lmsCourseId: string;
  courseCode: string | null;
  courseName: string;
};

export type LmsActivity = {
  lmsActivityId: string | null; // e-GURO's own id, if it gave one
  lmsType: string | null; // e-GURO's raw type label (for example ACTIVITY_QUIZ)
  type: ActivityKind;
  title: string;
  description: string | null;
  url: string | null;
  dueDate: Date | null;
  lmsCourseId: string | null; // null when e-GURO does not tell us the course
};

export type LmsCredentials = { username: string; password: string };
