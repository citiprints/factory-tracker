import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessPayments } from "@/lib/payments";
import { PAYMENT_MODES } from "@/lib/constants";
import { z } from "zod";

const CreatePaymentSchema = z.object({
	amount: z.number().positive(),
	receivedAt: z.string(),
	mode: z.enum(PAYMENT_MODES),
	notes: z.string().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can view payments." }, { status: 403 });
	}

	const { id } = await params;
	const [task, payments] = await Promise.all([
		prisma.task.findUnique({ where: { id }, select: { totalAmount: true } }),
		prisma.payment.findMany({
			where: { taskId: id },
			orderBy: { receivedAt: "asc" },
			include: { recordedBy: { select: { id: true, name: true } } },
		}),
	]);
	if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

	return NextResponse.json({ totalAmount: task.totalAmount, payments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can record payments." }, { status: 403 });
	}

	try {
		const { id } = await params;
		const json = await request.json();
		const data = CreatePaymentSchema.parse(json);

		const payment = await prisma.payment.create({
			data: {
				taskId: id,
				amount: data.amount,
				receivedAt: new Date(data.receivedAt),
				mode: data.mode,
				notes: data.notes || null,
				recordedById: user.id,
			},
			include: { recordedBy: { select: { id: true, name: true } } },
		});

		return NextResponse.json({ payment }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
