import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { maybeArchiveTask } from "@/lib/tasks";

// Forward-only: completes the first not-yet-completed stage for this item,
// in order. No skipping ahead or reopening a completed stage.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const stages = await prisma.itemStageProgress.findMany({
		where: { despatchItemId: id },
		orderBy: { stageIndex: "asc" },
	});
	const next = stages.find((s) => !s.completedAt);
	if (!next) {
		return NextResponse.json({ error: "All stages for this item are already complete." }, { status: 409 });
	}

	const now = new Date();
	const updated = await prisma.itemStageProgress.update({
		where: { id: next.id },
		data: {
			startedAt: next.startedAt ?? now,
			completedAt: now,
		},
	});

	const despatchItem = await prisma.despatchItem.findUnique({ where: { id } });

	await logActivity({
		entityType: "despatch_item",
		entityId: id,
		action: "STAGE_ADVANCED",
		actorId: user.id,
		taskId: despatchItem?.taskId,
		after: { stageName: updated.stageName },
	});

	const isLastStage = next.stageIndex === stages.length - 1;
	if (isLastStage && despatchItem && despatchItem.status !== "PACKED" && despatchItem.status !== "DESPATCHED") {
		await prisma.despatchItem.update({ where: { id }, data: { status: "PACKED" } });
		await logActivity({
			entityType: "despatch_item",
			entityId: id,
			action: "STATUS_CHANGE",
			actorId: user.id,
			taskId: despatchItem.taskId,
			before: { status: despatchItem.status },
			after: { status: "PACKED" },
		});
		await maybeArchiveTask(despatchItem.taskId);
	}

	return NextResponse.json({ stage: updated, isLastStage });
}
