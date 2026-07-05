import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const CreateSubtaskSchema = z.object({
	title: z.string().min(1),
	status: z.enum(["TODO","IN_PROGRESS","DONE","CANCELLED"]).optional(),
	assigneeId: z.string().uuid().nullable().optional(),
	dueAt: z.string().datetime().nullable().optional(),
	estimatedHours: z.number().nullable().optional(),
	order: z.number().int().optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id } = await params;
	const subtasks = await prisma.subtask.findMany({ where: { taskId: id } });
	return NextResponse.json({ subtasks });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const json = await request.json();
		const data = CreateSubtaskSchema.parse(json);
		const { id } = await params;
		const subtask = await prisma.subtask.create({
			data: {
				taskId: id,
				title: data.title,
				status: (data.status as any) ?? "TODO",
				assigneeId: data.assigneeId ?? null,
				dueAt: data.dueAt ? new Date(data.dueAt) : null,
				estimatedHours: data.estimatedHours ?? null,
				order: data.order ?? 0
			}
		});
		return NextResponse.json({ subtask }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
