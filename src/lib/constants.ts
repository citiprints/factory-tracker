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

export const DESPATCH_ITEM_STATUSES = [
  "PENDING_CLIENT_APPROVAL",
  "PRE_PRODUCTION",
  "PRODUCTION",
  "PACKED",
  "DESPATCHED",
] as const;
export type DespatchItemStatus = (typeof DESPATCH_ITEM_STATUSES)[number];

// Built-in item categories -- previously hardcoded identically in three
// separate <select> forms in src/app/tasks/page.tsx (create-task item form,
// edit-task item form, in-task "Add item" form), which is exactly the kind
// of duplication that's drifted out of sync before. Admin-added custom
// categories live in the TaskCategory table instead; this list is only the
// fixed built-in set.
export const BUILT_IN_ITEM_CATEGORIES = [
  "Rigid Boxes",
  "Cake Boxes",
  "Paper Bags",
  "Stickers",
  "Cards",
  "Invitation",
  "Paperboard Boxes",
  "Others",
] as const;

export const PAYMENT_MODES = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
