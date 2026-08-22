import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await prisma.categoryStageTemplate.findMany({ orderBy: { category: "asc" } });
	const templates = rows.map((r) => ({ category: r.category, stages: JSON.parse(r.stages) as string[] }));

	return NextResponse.json({ templates });
}

const UpsertSchema = z.object({
	category: z.string().min(1),
	stages: z.array(z.string().min(1)),
});

// Empty stages array deletes the template -- a category can opt back out of
// routing entirely, going back to the plain status dropdown for its items.
export async function PUT(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	try {
		const json = await request.json();
		const data = UpsertSchema.parse(json);

		if (data.stages.length === 0) {
			await prisma.categoryStageTemplate.deleteMany({ where: { category: data.category } });
			await logActivity({
				entityType: "category_stage_template",
				entityId: data.category,
				action: "DELETED",
				actorId: user.id,
			});
			return NextResponse.json({ template: null });
		}

		const existing = await prisma.categoryStageTemplate.findUnique({ where: { category: data.category } });
		const template = await prisma.categoryStageTemplate.upsert({
			where: { category: data.category },
			create: { category: data.category, stages: JSON.stringify(data.stages) },
			update: { stages: JSON.stringify(data.stages) },
		});

		await logActivity({
			entityType: "category_stage_template",
			entityId: data.category,
			action: existing ? "UPDATED" : "CREATED",
			actorId: user.id,
			before: existing ? { stages: JSON.parse(existing.stages) } : undefined,
			after: { stages: data.stages },
		});

		return NextResponse.json({ template: { category: template.category, stages: data.stages } });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
