import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await prisma.categoryStageTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
	const templates = rows.map((r) => ({ id: r.id, category: r.category, name: r.name, stages: JSON.parse(r.stages) as string[] }));

	return NextResponse.json({ templates });
}

const CreateSchema = z.object({
	category: z.string().min(1),
	name: z.string().min(1),
	stages: z.array(z.string().min(1)).min(1),
});

// Creates a new named route for a category -- a category can have several
// (e.g. "Standard" vs "Laminated") for jobs of the same category that take
// different real paths through production.
export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	try {
		const json = await request.json();
		const data = CreateSchema.parse(json);

		const existing = await prisma.categoryStageTemplate.findUnique({
			where: { category_name: { category: data.category, name: data.name } },
		});
		if (existing) {
			return NextResponse.json({ error: `"${data.name}" already exists for ${data.category}.` }, { status: 409 });
		}

		const template = await prisma.categoryStageTemplate.create({
			data: { category: data.category, name: data.name, stages: JSON.stringify(data.stages) },
		});

		await logActivity({
			entityType: "category_stage_template",
			entityId: template.id,
			action: "CREATED",
			actorId: user.id,
			after: { category: data.category, name: data.name, stages: data.stages },
		});

		return NextResponse.json({ template: { id: template.id, category: template.category, name: template.name, stages: data.stages } }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
