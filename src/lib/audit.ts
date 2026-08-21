import { prisma } from "@/lib/db";

type LogActivityInput = {
	entityType: string; // "task" | "despatch_item" | "payment" | "customer" | "user" | "auth"
	entityId: string;
	action: string; // e.g. "CREATED", "UPDATED", "DELETED", "STATUS_CHANGE", "LOGIN", "LOGIN_FAILED"
	actorId: string;
	taskId?: string;
	before?: unknown;
	after?: unknown;
};

// Best-effort, fire-and-forget-safe audit log write -- modeled on notifyUser()
// in src/lib/notify.ts. A logging failure must never break the request that
// triggered it, so errors are swallowed (and reported) rather than thrown.
export async function logActivity({ entityType, entityId, action, actorId, taskId, before, after }: LogActivityInput) {
	try {
		await prisma.activityLog.create({
			data: {
				entityType,
				entityId,
				action,
				actorId,
				taskId,
				before: before !== undefined ? JSON.stringify(before) : undefined,
				after: after !== undefined ? JSON.stringify(after) : undefined,
			},
		});
	} catch (err) {
		console.error("Audit log write failed (non-fatal):", err);
	}
}
