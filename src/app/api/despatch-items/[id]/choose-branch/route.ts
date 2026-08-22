import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { chooseBranch } from "@/lib/productionRouting";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const ChooseBranchSchema = z.object({
	edgeId: z.string().min(1),
});

// Used when an item's current stage has 2+ outgoing edges -- advance-stage
// stops there instead of guessing, and this picks which branch to follow.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const { edgeId } = ChooseBranchSchema.parse(await request.json());

		const despatchItem = await prisma.despatchItem.findUnique({ where: { id } });
		if (!despatchItem) return NextResponse.json({ error: "Item not found" }, { status: 404 });

		try {
			await chooseBranch(id, edgeId);
		} catch (error: any) {
			return NextResponse.json({ error: error.message ?? "Internal Server Error" }, { status: 409 });
		}

		const edge = await prisma.stageEdge.findUnique({ where: { id: edgeId }, include: { to: true } });

		await logActivity({
			entityType: "despatch_item",
			entityId: id,
			action: "BRANCH_CHOSEN",
			actorId: user.id,
			taskId: despatchItem.taskId,
			after: { stageName: edge?.to.name },
		});

		const stageProgress = await prisma.itemStageProgress.findMany({ where: { despatchItemId: id }, orderBy: { order: "asc" } });
		return NextResponse.json({ stageProgress });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
