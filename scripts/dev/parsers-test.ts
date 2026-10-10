// Quick checks of the e-GURO parsers with data shaped like the real reports. Run: npx tsx scripts/dev/parsers-test.ts
import { mergeItems, parseActivityPage, parseCoursesFromPage, parseLmsDate, hasClassListMarker } from "../../services/lms/parsers";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
const base = "https://lms.ccc.edu.ph";

// real-looking filter page snippet: classes inside a script, with "];" and brackets inside text
const page = `<script>var global_filter = 'DUE_TODAY'; var global_class = [{"teacher_class_student_id":0,"teacher_class_id":0,"student_id":0,"teacher_id":0,"class_name":"","subject_code":"ALL CLASS","subject_text":"","status":""},{"teacher_class_student_id":1,"teacher_class_id":19196,"student_id":9,"teacher_id":3,"class_name":"2-CS3","subject_code":"CS 201","subject_text":"Database [Mgmt]; Systems","status":""},{"teacher_class_id":"19197","subject_code":"IT 201","subject_text":"Data Structures"}]; var next = 1;</script>`;
const courses = parseCoursesFromPage(page);
check("reads 2 courses, skips ALL CLASS", courses.length === 2);
check("course code and name", courses[0].courseCode === "CS 201" && courses[0].courseName === "Database [Mgmt]; Systems");
check("string ids work", courses[1].lmsCourseId === "19197");
check("page without classes -> empty list", parseCoursesFromPage("<html></html>").length === 0);
check("broken JSON -> empty list, no crash", parseCoursesFromPage("var global_class = [{oops").length === 0);
// The marker separates "e-GURO changed this page" from "this student has no classes", so the checker can alert.
check("class-list marker found on a real filter page", hasClassListMarker(page));
check("class-list marker missing when the page changed", !hasClassListMarker("<html><body>Login required</body></html>"));

const result = parseActivityPage({ last_page: "2", total_record: 3, data: [
  { class_exam_id: 55, teacher_class_id: 19196, title: "  Quiz 1  ", mark_type: "exam", term: 2, from_date: "2026-10-01 08:00:00", to_date: "2026-10-09 23:59:00" },
  { class_exam_id: "56", teacher_class_id: "19197", title: "Lesson 2", mark_type: "LESSON", term: "1", from_date: "0000-00-00 00:00:00" },
  { title: "No ids" },
  { class_exam_id: 57 },
] }, base);
check("last_page read as a number", result.lastPage === 2);
check("rows without a title are skipped", result.items.length === 3);
check("EXAM -> QUIZ, LESSON -> ACTIVITY", result.items[0].type === "QUIZ" && result.items[1].type === "ACTIVITY");
check("title trimmed, type upper-cased", result.items[0].title === "Quiz 1" && result.items[0].lmsType === "EXAM");
check("exam link", result.items[0].url === `${base}/app/open_exam.php?id=19196&param=55&terms=2`);
check("lesson link", result.items[1].url === `${base}/app/open_lesson.php?id=19197&param=56&terms=1`);
check("zero date is empty, not invented", result.items[1].postedAt === null && result.items[1].dueDate === null);
check("dates read as Philippine time", result.items[0].dueDate?.toISOString() === "2026-10-09T15:59:00.000Z");
check("missing ids stay empty", result.items[2].lmsActivityId === null && result.items[2].url === null && result.items[2].lmsCourseId === null);
check("empty reply is fine", parseActivityPage({ last_page: 0, data: [], total_record: 0 }, base).items.length === 0);
let threw = false;
try { parseActivityPage("<html>", base); } catch { threw = true; }
check("non-JSON shape raises a format error", threw);
check("date parser rejects garbage", parseLmsDate("not a date") === null);

// --- rows shaped like the real reports (ASSIGNED / UNREAD lists) ---
const realRow = { class_exam_id: "120299", title: "Activity 3", date_added: "2026-10-01 07:00:00", term: "3", teacher_class_id: "19197", exam_type: "1", submit_answer: "1", date_deadline: "2026-10-12 23:59:00", from_date: "2026-10-01 08:00:00", to_date: "2026-10-30 23:59:00", review_date: "2026-10-30", grade: null, status: "", mark_type: "LESSON" };
const assigned = parseActivityPage({ last_page: 0, total_record: 0, data: [realRow] }, base, { requestType: "LESSON", status: "ASSIGNED", unread: false });
check("real ASSIGNED row: pending, not material", assigned.items[0].status === "ASSIGNED" && assigned.items[0].isMaterial === false && assigned.items[0].unread === false);
check("deadline is used as the due date (not to_date)", assigned.items[0].dueDate?.toISOString() === "2026-10-12T15:59:00.000Z");
check("last_page 0 with rows still reports the row count", assigned.rowCount === 1 && assigned.lastPage === 0);
const { mark_type, ...unreadRowBase } = realRow; void mark_type;
const unreadRow = { ...unreadRowBase, submit_answer: "0", class_exam_id: "120300", title: "Lesson 5" };
const unread = parseActivityPage({ data: [unreadRow] }, base, { requestType: "LESSON", status: null, unread: true });
check("UNREAD row without mark_type gets the request type", unread.items[0].lmsType === "LESSON");
check("submit_answer 0 = reading material, unread, not pending", unread.items[0].isMaterial === true && unread.items[0].unread === true && unread.items[0].status === null);
check("EXAM is never material", parseActivityPage({ data: [{ ...realRow, mark_type: "EXAM", submit_answer: "0" }] }, base).items[0].isMaterial === false);
check("date with no time = end of that day", parseLmsDate("2026-10-30")?.toISOString() === "2026-10-30T15:59:00.000Z");
const both = mergeItems([...assigned.items, ...parseActivityPage({ data: [realRow] }, base, { requestType: "LESSON", status: "DUE_TODAY", unread: false }).items, ...parseActivityPage({ data: [{ ...realRow }] }, base, { requestType: "LESSON", status: null, unread: true }).items]);
check("same item in 3 lists becomes one, strongest status, still unread", both.length === 1 && both[0].status === "DUE_TODAY" && both[0].unread === true);

console.log(failed ? `\n${failed} FAILED` : "\nAll parser checks passed");
process.exit(failed ? 1 : 0);
