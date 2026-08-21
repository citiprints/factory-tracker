import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessPayments } from "@/lib/payments";

type PaymentStatus = "NOT_SET" | "UNPAID" | "PARTIAL" | "FULLY_PAID";

function computeStatus(totalAmount: number | null, received: number): PaymentStatus {
	if (totalAmount == null) return "NOT_SET";
	if (received <= 0) return "UNPAID";
	if (received >= totalAmount) return "FULLY_PAID";
	return "PARTIAL";
}

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can view payments." }, { status: 403 });
	}

	const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

	const rawTasks = await prisma.task.findMany({
		where: includeArchived ? {} : { status: { not: "ARCHIVED" } },
		include: {
			customerRef: { select: { id: true, name: true } },
			payments: { select: { amount: true, receivedAt: true } },
		},
		orderBy: { createdAt: "desc" },
	});

	const tasks = rawTasks.map((t) => {
		// Same "received >= totalAmount" comparison maybeArchiveTask() in
		// src/lib/tasks.ts uses for "fully paid" -- kept consistent rather
		// than reinvented.
		const received = t.payments.reduce((sum, p) => sum + p.amount, 0);
		const balance = t.totalAmount == null ? null : t.totalAmount - received;
		const lastPaymentAt = t.payments.length
			? t.payments.reduce((latest, p) => (p.receivedAt > latest ? p.receivedAt : latest), t.payments[0].receivedAt)
			: null;
		return {
			id: t.id,
			title: t.title,
			status: t.status,
			dueAt: t.dueAt,
			customer: t.customerRef,
			totalAmount: t.totalAmount,
			received,
			balance,
			paymentStatus: computeStatus(t.totalAmount, received),
			lastPaymentAt,
		};
	});

	const summary = tasks.reduce(
		(acc, t) => ({
			totalBilled: acc.totalBilled + (t.totalAmount ?? 0),
			totalReceived: acc.totalReceived + t.received,
			totalOutstanding: acc.totalOutstanding + (t.balance != null && t.balance > 0 ? t.balance : 0),
		}),
		{ totalBilled: 0, totalReceived: 0, totalOutstanding: 0 }
	);

	return NextResponse.json({ tasks, summary });
}
