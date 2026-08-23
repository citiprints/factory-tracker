import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { undoStage } from "@/lib/productionRouting";
import { z } from "zod";

const UndoSchema = z.object({
	stageId: z.string().min(1),
});

// Reverses one tick: a completed stage goes back to in-progress, an
// in-progress one (reached via a choice or an AND fan-out) is removed
// outright. See undoStage for the safety rules around what it'll refuse to
// touch.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	let stageId: string;
	try {
		({ stageId } = UndoSchema.parse(await request.json()));
	} catch (error) {
		if (error instanceof z.ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}

	const stage = await prisma.itemStageProgress.findUnique({ where: { id: stageId } });
	if (!stage || stage.despatchItemId !== id) {
		return NextResponse.json({ error: "Stage not found for this item." }, { status: 404 });
	}

	try {
		await undoStage(id, stageId);
	} catch (error: any) {
		return NextResponse.json({ error: error.message ?? "Internal Server Error" }, { status: 409 });
	}

	const despatchItem = await prisma.despatchItem.findUnique({ where: { id } });
	await logActivity({
		entityType: "despatch_item",
		entityId: id,
		action: "STAGE_UNDONE",
		actorId: user.id,
		taskId: despatchItem?.taskId,
		after: { stageName: stage.stageName },
	});

	const stageProgress = await prisma.itemStageProgress.findMany({ where: { despatchItemId: id }, orderBy: { order: "asc" } });
	return NextResponse.json({ stageProgress });
}
