import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const UpdateQuickTaskSchema = z.object({
	text: z.string().min(1).optional(),
	dueAt: z.string().nullable().optional(),
	done: z.boolean().optional(),
});

async function ownedByUser(id: string, userId: string) {
	const existing = await prisma.quickTask.findUnique({ where: { id }, select: { createdById: true } });
	return existing?.createdById === userId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	if (!(await ownedByUser(id, user.id))) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	try {
		const json = await request.json();
		const data = UpdateQuickTaskSchema.parse(json);

		const quickTask = await prisma.quickTask.update({
			where: { id },
			data: {
				...("text" in data ? { text: data.text!.trim() } : {}),
				...("dueAt" in data ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
				...("done" in data ? { done: data.done } : {}),
			},
		});

		return NextResponse.json({ quickTask });
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

	const { id } = await params;
	if (!(await ownedByUser(id, user.id))) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	await prisma.quickTask.delete({ where: { id } });
	return NextResponse.json({ ok: true });
}
