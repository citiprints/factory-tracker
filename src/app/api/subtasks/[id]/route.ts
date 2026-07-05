import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const UpdateSubtaskSchema = z.object({
	title: z.string().min(1).optional(),
	status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
	assigneeId: z.string().nullable().optional(),
	dueAt: z.string().nullable().optional(),
	estimatedHours: z.number().nullable().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const subtask = await prisma.subtask.findUnique({
			where: { id },
			include: {
				assignee: {
					select: { id: true, name: true, email: true }
				}
			}
		});

		if (!subtask) {
			return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
		}

		return NextResponse.json({ subtask });
	} catch (error) {
		console.error("GET /api/subtasks/[id] error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const json = await request.json();
		const data = UpdateSubtaskSchema.parse(json);
		const { id } = await params;

		const subtask = await prisma.subtask.update({
			where: { id },
			data: {
				...("title" in data ? { title: data.title! } : {}),
				...("status" in data ? { status: data.status as any } : {}),
				...("assigneeId" in data ? { assigneeId: data.assigneeId } : {}),
				...("dueAt" in data ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
				...("estimatedHours" in data ? { estimatedHours: data.estimatedHours } : {}),
			},
			include: {
				assignee: {
					select: { id: true, name: true, email: true }
				}
			}
		});

		return NextResponse.json({ subtask });
	} catch (error) {
		console.error("PATCH /api/subtasks/[id] error:", error);
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		await prisma.subtask.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("DELETE /api/subtasks/[id] error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
