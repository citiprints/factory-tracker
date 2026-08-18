import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessPayments } from "@/lib/payments";
import { PAYMENT_MODES } from "@/lib/constants";
import { maybeArchiveTask } from "@/lib/tasks";
import { z } from "zod";

const UpdatePaymentSchema = z.object({
	amount: z.number().positive().optional(),
	receivedAt: z.string().optional(),
	mode: z.enum(PAYMENT_MODES).optional(),
	notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can edit payments." }, { status: 403 });
	}

	try {
		const { id } = await params;
		const json = await request.json();
		const data = UpdatePaymentSchema.parse(json);

		const payment = await prisma.payment.update({
			where: { id },
			data: {
				...("amount" in data ? { amount: data.amount } : {}),
				...("receivedAt" in data ? { receivedAt: new Date(data.receivedAt!) } : {}),
				...("mode" in data ? { mode: data.mode } : {}),
				...("notes" in data ? { notes: data.notes || null } : {}),
			},
			include: { recordedBy: { select: { id: true, name: true } } },
		});

		await maybeArchiveTask(payment.taskId);

		return NextResponse.json({ payment });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can delete payments." }, { status: 403 });
	}

	const { id } = await params;
	const payment = await prisma.payment.delete({ where: { id } });
	await maybeArchiveTask(payment.taskId);
	return NextResponse.json({ ok: true });
}
