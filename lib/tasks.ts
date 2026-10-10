// Limits, validation and ordering for personal tasks. They protect the free database (every student
// shares it) and the page. Mirrors lib/notes.ts on purpose: same shape, same rules.
import type { TaskPriority, TaskStatus } from "../generated/prisma/client";

export const TASK_LIMITS = {
  titleMax: 200,
  descriptionMax: 4_000, // characters
  tasksPerStudent: 1_000,
} as const;

export const TASK_PRIORITIES: readonly TaskPriority[] = ["LOW", "NORMAL", "HIGH"];
export const TASK_STATUSES: readonly TaskStatus[] = ["OPEN", "DONE"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High" };

const PRIORITY_RANK: Record<TaskPriority, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };

export function validateTitle(value: unknown): string | null {
  if (typeof value !== "string") return "Give the task a title.";
  const title = value.replace(/\s+/g, " ").trim();
  if (!title) return "Give the task a title.";
  if (title.length > TASK_LIMITS.titleMax) return `The title can be at most ${TASK_LIMITS.titleMax} characters.`;
  return null;
}

export function validateDescription(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return "The description is not valid.";
  if (value.length > TASK_LIMITS.descriptionMax) return `The description can be at most ${TASK_LIMITS.descriptionMax.toLocaleString()} characters.`;
  return null;
}

// undefined = "leave it alone"; null = "not a valid value".
export function cleanPriority(value: unknown): TaskPriority | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return TASK_PRIORITIES.includes(upper as TaskPriority) ? (upper as TaskPriority) : null;
}

export function cleanStatus(value: unknown): TaskStatus | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return TASK_STATUSES.includes(upper as TaskStatus) ? (upper as TaskStatus) : null;
}

// A date-only value from an <input type="date"> is read as the end of that day in Philippine time,
// the same way e-GURO dates are read (see services/lms/parsers.ts).
export type DueDateResult = { ok: true; date: Date | null } | { ok: false; message: string };

export function cleanDueDate(value: unknown): DueDateResult {
  if (value === null || value === undefined || value === "") return { ok: true, date: null };
  if (typeof value !== "string") return { ok: false, message: "The due date is not valid." };
  const text = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T23:59:00+08:00`)
    : new Date(text);
  if (Number.isNaN(date.getTime())) return { ok: false, message: "The due date is not valid." };
  return { ok: true, date };
}

// Unfinished first, then by due date (soonest, undated last), then by priority, then newest.
export function sortTasks<T extends { status: TaskStatus; priority: TaskPriority; dueDate: Date | null; createdAt: Date }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "DONE" ? 1 : -1;
    const due = (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
    if (due !== 0) return due;
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}