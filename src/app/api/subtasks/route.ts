import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const CreateSubtaskSchema = z.object({
	taskId: z.string().min(1),
	title: z.string().min(1),
	assigneeId: z.string().nullable().optional(),
	dueAt: z.string().nullable().optional(),
	estimatedHours: z.number().nullable().optional(),
});

const UpdateSubtaskSchema = z.object({
	title: z.string().min(1).optional(),
	status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
	assigneeId: z.string().nullable().optional(),
	dueAt: z.string().nullable().optional(),
	estimatedHours: z.number().nullable().optional(),
});

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const taskId = searchParams.get("taskId");

	if (!taskId) {
		return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
	}

	try {
		const subtasks = await prisma.subtask.findMany({
			where: { taskId },
			include: {
				assignee: {
					select: { id: true, name: true, email: true }
				}
			},
			orderBy: { order: 'asc' }
		});

		return NextResponse.json({ subtasks });
	} catch (error) {
		console.error("GET /api/subtasks error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const json = await request.json();
		const data = CreateSubtaskSchema.parse(json);

		// Get the highest order number for this task
		const lastSubtask = await prisma.subtask.findFirst({
			where: { taskId: data.taskId },
			orderBy: { order: 'desc' }
		});

		const newOrder = (lastSubtask?.order || 0) + 1;

		const subtask = await prisma.subtask.create({
			data: {
				taskId: data.taskId,
				title: data.title,
				assigneeId: data.assigneeId || null,
				dueAt: data.dueAt ? new Date(data.dueAt) : null,
				estimatedHours: data.estimatedHours || null,
				order: newOrder
			},
			include: {
				assignee: {
					select: { id: true, name: true, email: true }
				}
			}
		});

		return NextResponse.json({ subtask }, { status: 201 });
	} catch (error) {
		console.error("POST /api/subtasks error:", error);
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
