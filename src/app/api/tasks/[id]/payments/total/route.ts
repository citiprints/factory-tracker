import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessPayments } from "@/lib/payments";
import { maybeArchiveTask } from "@/lib/tasks";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const UpdateTotalSchema = z.object({
	totalAmount: z.number().nonnegative().nullable(),
});

// Its own tiny route rather than folding into the main task PATCH endpoint,
// which has its own delicate worker-must-be-assignee/status-only gate that
// has nothing to do with payment access.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can set the total amount." }, { status: 403 });
	}

	try {
		const { id } = await params;
		const json = await request.json();
		const { totalAmount } = UpdateTotalSchema.parse(json);

		const previous = await prisma.task.findUnique({ where: { id }, select: { totalAmount: true } });

		const task = await prisma.task.update({
			where: { id },
			data: { totalAmount },
			select: { id: true, totalAmount: true },
		});

		await logActivity({
			entityType: "task",
			entityId: id,
			action: "TOTAL_AMOUNT_SET",
			actorId: user.id,
			taskId: id,
			before: previous ?? undefined,
			after: { totalAmount: task.totalAmount },
		});

		await maybeArchiveTask(id);

		return NextResponse.json({ task });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
