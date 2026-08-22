import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { instantiateStages } from "@/lib/productionRouting";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const ChooseRouteSchema = z.object({
	templateId: z.string().min(1),
});

// Used when an item's category has 2+ named routes -- the PATCH route's
// auto-instantiate only fires when there's exactly one unambiguous choice,
// so someone has to pick explicitly here instead.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const { templateId } = ChooseRouteSchema.parse(await request.json());

		const despatchItem = await prisma.despatchItem.findUnique({ where: { id } });
		if (!despatchItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

		const existingProgress = await prisma.itemStageProgress.count({ where: { despatchItemId: id } });
		if (existingProgress > 0) {
			return NextResponse.json({ error: "This item's route has already been chosen." }, { status: 409 });
		}

		const template = await prisma.categoryStageTemplate.findUnique({ where: { id: templateId } });
		if (!template) return NextResponse.json({ error: "Route not found" }, { status: 404 });

		let category: string | undefined;
		try {
			category = despatchItem.specFields ? JSON.parse(despatchItem.specFields).category : undefined;
		} catch {}
		if (template.category !== category) {
			return NextResponse.json({ error: "That route doesn't belong to this item's category." }, { status: 400 });
		}

		const stages: string[] = JSON.parse(template.stages);
		await instantiateStages(id, stages);

		await logActivity({
			entityType: "despatch_item",
			entityId: id,
			action: "ROUTE_CHOSEN",
			actorId: user.id,
			taskId: despatchItem.taskId,
			after: { templateName: template.name, stages },
		});

		const stageProgress = await prisma.itemStageProgress.findMany({ where: { despatchItemId: id }, orderBy: { stageIndex: "asc" } });
		return NextResponse.json({ stageProgress });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
