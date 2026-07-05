// Single source of truth for status/priority values used across
// task, subtask, and quotation API routes.
//
// Previously each route hand-wrote its own z.enum([...]) list, and they
// drifted out of sync -- e.g. the task update route didn't accept
// "BLOCKED" or "CANCELLED" even though the create route did, meaning a
// blocked/cancelled task could never be changed back. Import from here
// instead of retyping the list.

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "CANCELLED",
  "ARCHIVED",
  "CLIENT_TO_REVERT",
  "OTHERS",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const SUBTASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export type SubtaskStatus = (typeof SUBTASK_STATUSES)[number];
