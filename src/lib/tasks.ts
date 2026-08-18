import { prisma } from "@/lib/db";

// A task auto-archives once it's fully paid and every item has shipped.
// Requires a total amount and at least one item -- a task with neither set
// up yet never auto-archives, so an incomplete task can't disappear early.
export async function maybeArchiveTask(taskId: string) {
	const task = await prisma.task.findUnique({
		where: { id: taskId },
		include: { despatchItems: true, payments: true },
	});
	if (!task || task.status === "ARCHIVED") return;
	if (task.totalAmount == null || task.despatchItems.length === 0) return;

	const received = task.payments.reduce((sum, p) => sum + p.amount, 0);
	const fullyPaid = received >= task.totalAmount;
	const allDespatched = task.despatchItems.every((i) => i.status === "DESPATCHED");

	if (fullyPaid && allDespatched) {
		await prisma.task.update({ where: { id: taskId }, data: { status: "ARCHIVED" } });
	}
}
