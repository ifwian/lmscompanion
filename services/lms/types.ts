// The shapes the rest of the app uses. Nothing outside services/lms knows about e-GURO's raw responses.
export type ActivityKind = "ACTIVITY" | "QUIZ" | "ASSIGNMENT" | "ANNOUNCEMENT";

export type LmsCourse = {
  lmsCourseId: string; // e-GURO's teacher_class_id
  courseCode: string | null; // for example "CS 201"
  courseName: string;
};

export type LmsActivity = {
  lmsActivityId: string | null; // e-GURO's own id (class_exam_id), if it gave one
  lmsType: string | null; // e-GURO's raw type label (mark_type: LESSON or EXAM)
  type: ActivityKind;
  title: string;
  description: string | null;
  url: string | null;
  dueDate: Date | null;
  postedAt: Date | null; // e-GURO's from_date
  lmsCourseId: string | null; // teacher_class_id; null when e-GURO does not tell us the course
  status: PendingStatus | null; // which pending list it is in right now (null = not pending)
  unread: boolean; // it is in e-GURO's UNREAD list right now
  isMaterial: boolean; // reading material (submit_answer = 0), not something to hand in
};

export type PendingStatus = "ASSIGNED" | "DUE_TODAY" | "MISSED";

export type LmsCredentials = { username: string; password: string };
