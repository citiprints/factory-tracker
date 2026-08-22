import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const UpdateSchema = z.object({
	name: z.string().min(1).optional(),
	stages: z.array(z.string().min(1)).min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	try {
		const { id } = await params;
		const json = await request.json();
		const data = UpdateSchema.parse(json);

		const previous = await prisma.categoryStageTemplate.findUnique({ where: { id } });
		if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 });

		const template = await prisma.categoryStageTemplate.update({
			where: { id },
			data: {
				...("name" in data ? { name: data.name } : {}),
				...("stages" in data ? { stages: JSON.stringify(data.stages) } : {}),
			},
		});

		await logActivity({
			entityType: "category_stage_template",
			entityId: id,
			action: "UPDATED",
			actorId: user.id,
			before: { name: previous.name, stages: JSON.parse(previous.stages) },
			after: { name: template.name, stages: JSON.parse(template.stages) },
		});

		return NextResponse.json({ template: { id: template.id, category: template.category, name: template.name, stages: JSON.parse(template.stages) } });
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
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	const { id } = await params;
	const template = await prisma.categoryStageTemplate.findUnique({ where: { id } });
	if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

	await prisma.categoryStageTemplate.delete({ where: { id } });

	await logActivity({
		entityType: "category_stage_template",
		entityId: id,
		action: "DELETED",
		actorId: user.id,
		before: { category: template.category, name: template.name },
	});

	return NextResponse.json({ ok: true });
}
