import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const CreateQuickTaskSchema = z.object({
	text: z.string().min(1),
	dueAt: z.string().nullable().optional(),
});

// Personal to-do list -- always scoped to the signed-in user, no team or
// admin visibility into anyone else's.
export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const quickTasks = await prisma.quickTask.findMany({
		where: { createdById: user.id },
		orderBy: [{ done: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
	});

	return NextResponse.json({ quickTasks });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const json = await request.json();
		const data = CreateQuickTaskSchema.parse(json);

		const quickTask = await prisma.quickTask.create({
			data: {
				text: data.text.trim(),
				dueAt: data.dueAt ? new Date(data.dueAt) : null,
				createdById: user.id,
			},
		});

		return NextResponse.json({ quickTask }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
